"""Product Understanding LangGraph agent."""

import json
import uuid
from typing import Annotated, TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.services.llm import get_chat_model
from gtm_api.models import Entity, Product, ProfileFieldStatus
from gtm_api.services.citation_gate import (
    SYSTEM_PROMPT_GROUNDED,
    build_context_from_results,
)
from gtm_api.services.embeddings import embedding_service
from gtm_api.services.knowledge_graph import knowledge_graph
from gtm_api.services.vector_store import vector_store
from gtm_api.tenant import record_usage

settings = get_settings()

EXTRACTION_PROMPT = """Analyze the following product documentation and extract structured information.
Return a JSON object with these fields:
- summary: brief product summary (2-3 sentences)
- features: list of key features
- technical_stack: list of technologies used
- industry: primary industry
- target_personas: list of target buyer personas
- competitors: list of known competitors (only if explicitly mentioned)
- pricing: pricing information (only if explicitly mentioned, else null)
- faqs: list of {question, answer} objects
- architecture: architecture description if available
- use_cases: list of use cases
- pain_points: list of customer pain points addressed
- roi_statements: list of ROI/value statements
- value_propositions: list of value propositions

Mark fields you are uncertain about. Only include information found in the sources.

Sources:
{context}
"""


class ProductUnderstandingState(TypedDict):
    product_id: str
    tenant_id: str
    context: str
    profile: dict
    entities: list[dict]
    tokens_used: int


async def retrieve_context(state: ProductUnderstandingState) -> ProductUnderstandingState:
    query = "product features architecture pricing competitors target customers use cases"
    vector = await embedding_service.embed_query(query)
    results = await vector_store.search(
        uuid.UUID(state["tenant_id"]),
        uuid.UUID(state["product_id"]),
        vector,
        limit=10,
    )
    state["context"] = build_context_from_results(results)
    return state


async def extract_profile(state: ProductUnderstandingState) -> ProductUnderstandingState:
    llm = get_chat_model("product_understanding", temperature=0.1)

    prompt = EXTRACTION_PROMPT.format(context=state["context"])
    response = await llm.ainvoke([
        {"role": "system", "content": SYSTEM_PROMPT_GROUNDED},
        {"role": "user", "content": prompt},
    ])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        profile = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        profile = {"summary": response.content, "features": []}

    field_status = {k: "inferred" for k in profile.keys() if k != "field_status"}
    profile["field_status"] = field_status
    state["profile"] = profile
    state["tokens_used"] = state.get("tokens_used", 0) + 1000
    return state


async def extract_entities(state: ProductUnderstandingState) -> ProductUnderstandingState:
    profile = state["profile"]
    entities = []

    entity_mappings = [
        ("features", "Feature"),
        ("technical_stack", "Technology"),
        ("target_personas", "Persona"),
        ("competitors", "Competitor"),
        ("pain_points", "PainPoint"),
        ("use_cases", "UseCase"),
    ]

    for field, entity_type in entity_mappings:
        items = profile.get(field, [])
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str) and item.strip():
                    entities.append({
                        "entity_type": entity_type,
                        "name": item.strip(),
                        "canonical_name": item.strip().lower(),
                        "confidence": 0.7,
                    })

    if profile.get("industry"):
        entities.append({
            "entity_type": "Industry",
            "name": profile["industry"],
            "canonical_name": profile["industry"].lower(),
            "confidence": 0.8,
        })

    state["entities"] = entities
    return state


def build_product_understanding_graph() -> StateGraph:
    graph = StateGraph(ProductUnderstandingState)
    graph.add_node("retrieve", retrieve_context)
    graph.add_node("extract_profile", extract_profile)
    graph.add_node("extract_entities", extract_entities)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "extract_profile")
    graph.add_edge("extract_profile", "extract_entities")
    graph.add_edge("extract_entities", END)
    return graph


async def run_product_understanding(
    db: AsyncSession,
    product: Product,
    tenant_id: uuid.UUID,
) -> dict:
    graph = build_product_understanding_graph()
    app = graph.compile()

    initial_state: ProductUnderstandingState = {
        "product_id": str(product.id),
        "tenant_id": str(tenant_id),
        "context": "",
        "profile": {},
        "entities": [],
        "tokens_used": 0,
    }

    result = await app.ainvoke(initial_state)
    profile = result["profile"]

    product.profile = profile
    product.profile_status = "ready"
    await db.flush()

    for entity_data in result.get("entities", []):
        entity = Entity(
            product_id=product.id,
            tenant_id=tenant_id,
            entity_type=entity_data["entity_type"],
            name=entity_data["name"],
            canonical_name=entity_data["canonical_name"],
            confidence=entity_data.get("confidence", 0.5),
            status=ProfileFieldStatus.INFERRED,
        )
        db.add(entity)

        try:
            node_id = await knowledge_graph.upsert_entity(
                tenant_id=tenant_id,
                product_id=product.id,
                entity_type=entity_data["entity_type"],
                name=entity_data["name"],
                canonical_name=entity_data["canonical_name"],
                confidence=entity_data.get("confidence", 0.5),
                entity_id=str(entity.id) if hasattr(entity, "id") else None,
            )
            entity.neo4j_node_id = node_id
        except Exception:
            pass

    await record_usage(db, tenant_id, tokens=result.get("tokens_used", 0), agent_runs=1)
    return profile
