"""Neo4j knowledge graph service with tenant isolation."""

import uuid
from typing import Optional

from neo4j import AsyncGraphDatabase

from gtm_api.config import get_settings

settings = get_settings()

ENTITY_TYPES = {
    "Product", "Feature", "Technology", "Industry", "Persona",
    "Competitor", "PainPoint", "UseCase", "PricingTier", "FAQ",
}

RELATION_TYPES = {
    "HAS_FEATURE", "USES_TECHNOLOGY", "TARGETS_INDUSTRY", "TARGETS_PERSONA",
    "COMPETES_WITH", "SOLVES", "SUPPORTS_USE_CASE", "HAS_PRICING", "HAS_FAQ",
}


class KnowledgeGraph:
    def __init__(self) -> None:
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )

    async def close(self) -> None:
        await self._driver.close()

    async def ensure_constraints(self) -> None:
        async with self._driver.session() as session:
            await session.run(
                "CREATE CONSTRAINT entity_unique IF NOT EXISTS "
                "FOR (e:Entity) REQUIRE (e.tenant_id, e.product_id, e.canonical_name, e.entity_type) IS UNIQUE"
            )

    async def upsert_entity(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        entity_type: str,
        name: str,
        canonical_name: str,
        properties: Optional[dict] = None,
        confidence: float = 0.0,
        entity_id: Optional[str] = None,
    ) -> str:
        if entity_type not in ENTITY_TYPES:
            entity_type = "Feature"

        async with self._driver.session() as session:
            result = await session.run(
                """
                MERGE (e:Entity {
                    tenant_id: $tenant_id,
                    product_id: $product_id,
                    canonical_name: $canonical_name,
                    entity_type: $entity_type
                })
                SET e.name = $name,
                    e.properties = $properties,
                    e.confidence = $confidence,
                    e.entity_id = $entity_id,
                    e.updated_at = datetime()
                RETURN elementId(e) AS node_id
                """,
                tenant_id=str(tenant_id),
                product_id=str(product_id),
                entity_type=entity_type,
                name=name,
                canonical_name=canonical_name.lower().strip(),
                properties=properties or {},
                confidence=confidence,
                entity_id=entity_id or str(uuid.uuid4()),
            )
            record = await result.single()
            return record["node_id"] if record else ""

    async def upsert_relation(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        source_canonical: str,
        source_type: str,
        target_canonical: str,
        target_type: str,
        relation_type: str,
        properties: Optional[dict] = None,
    ) -> None:
        if relation_type not in RELATION_TYPES:
            relation_type = "HAS_FEATURE"

        async with self._driver.session() as session:
            await session.run(
                f"""
                MATCH (s:Entity {{
                    tenant_id: $tenant_id, product_id: $product_id,
                    canonical_name: $source_canonical, entity_type: $source_type
                }})
                MATCH (t:Entity {{
                    tenant_id: $tenant_id, product_id: $product_id,
                    canonical_name: $target_canonical, entity_type: $target_type
                }})
                MERGE (s)-[r:{relation_type}]->(t)
                SET r.properties = $properties, r.updated_at = datetime()
                """,
                tenant_id=str(tenant_id),
                product_id=str(product_id),
                source_canonical=source_canonical.lower().strip(),
                source_type=source_type,
                target_canonical=target_canonical.lower().strip(),
                target_type=target_type,
                properties=properties or {},
            )

    async def query_entities(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        entity_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        async with self._driver.session() as session:
            if entity_type:
                result = await session.run(
                    """
                    MATCH (e:Entity {tenant_id: $tenant_id, product_id: $product_id, entity_type: $entity_type})
                    RETURN e.name AS name, e.entity_type AS entity_type, e.properties AS properties,
                           e.confidence AS confidence
                    LIMIT $limit
                    """,
                    tenant_id=str(tenant_id),
                    product_id=str(product_id),
                    entity_type=entity_type,
                    limit=limit,
                )
            else:
                result = await session.run(
                    """
                    MATCH (e:Entity {tenant_id: $tenant_id, product_id: $product_id})
                    RETURN e.name AS name, e.entity_type AS entity_type, e.properties AS properties,
                           e.confidence AS confidence
                    LIMIT $limit
                    """,
                    tenant_id=str(tenant_id),
                    product_id=str(product_id),
                    limit=limit,
                )
            records = await result.data()
            return records

    async def delete_product_graph(
        self, tenant_id: uuid.UUID, product_id: uuid.UUID
    ) -> None:
        async with self._driver.session() as session:
            await session.run(
                """
                MATCH (e:Entity {tenant_id: $tenant_id, product_id: $product_id})
                DETACH DELETE e
                """,
                tenant_id=str(tenant_id),
                product_id=str(product_id),
            )


knowledge_graph = KnowledgeGraph()
