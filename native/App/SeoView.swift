import AuroraKit
import SwiftUI

private enum SeoMode: String, CaseIterable, Identifiable {
    case audit = "Page audit", keywords = "Keywords", score = "Content score"
    var id: String { rawValue }
}

struct SeoView: View {
    let product: Product
    @State private var mode: SeoMode = .audit

    var body: some View {
        VStack(spacing: 0) {
            Picker("Tool", selection: $mode) { ForEach(SeoMode.allCases) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented).labelsHidden().frame(maxWidth: 420).padding(.vertical, 12)
            Divider()
            switch mode {
            case .audit: AuditPane(product: product)
            case .keywords: KeywordsPane(product: product)
            case .score: ScorePane(product: product)
            }
        }
    }
}

private func severityColor(_ s: String) -> Color {
    switch s { case "critical": .red; case "warning": .orange; default: .secondary }
}

private struct ScoreBadge: View {
    let score: Int
    var body: some View {
        let tone: Color = score >= 80 ? .green : (score < 50 ? .red : .orange)
        VStack(spacing: 0) {
            Text("\(score)").font(.system(size: 36, weight: .semibold, design: .rounded)).foregroundStyle(tone)
            Text("SEO score").font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SEO score \(score) out of 100")
    }
}

private struct AuditPane: View {
    @Environment(AppStore.self) private var store
    let product: Product
    @State private var url = ""
    @State private var result: SeoAudit?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                TextField("Public page URL, e.g. https://example.com/pricing", text: $url)
                    .textFieldStyle(.roundedBorder).onSubmit(run)
                Button(action: run) { if busy { ProgressView().controlSize(.small) } else { Text("Audit page") } }
                    .buttonStyle(.borderedProminent).disabled(url.isEmpty || busy)
            }
            .padding([.horizontal, .top], 20)
            if let r = result {
                HStack(spacing: 22) {
                    ScoreBadge(score: r.score)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.title.isEmpty ? "No title" : r.title).font(.headline).foregroundStyle(Color.accentColor)
                        Text(r.metaDescription.isEmpty ? "No meta description. Search engines will pick text from the page." : r.metaDescription)
                            .font(.callout).foregroundStyle(.secondary).lineLimit(2)
                        Text("\(r.wordCount) words · \(r.internalLinks) internal links · \(r.imagesMissingAlt) images missing alt")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)
                List(r.findings) { f in
                    HStack(alignment: .top, spacing: 10) {
                        Text(f.severity.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(severityColor(f.severity)).frame(width: 64, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(f.message)
                            Text(f.fix).font(.callout).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .overlay { if r.findings.isEmpty { ContentUnavailableView("No issues found", systemImage: "checkmark.seal", description: Text("This page passes every check.")) } }
            } else {
                ContentUnavailableView("Audit a page", systemImage: "magnifyingglass",
                    description: Text("Checks title, description, headings, canonical, structured data, images and links. Everything comes from the page itself."))
            }
        }
        .onAppear { if url.isEmpty { url = product.websiteUrl ?? "" } }
    }

    private func run() {
        guard let c = store.client, !url.isEmpty else { return }
        busy = true
        Task {
            defer { busy = false }
            do { result = try await c.seoAudit(productId: product.id, url: url) } catch { store.handle(error) }
        }
    }
}

private struct KeywordsPane: View {
    @Environment(AppStore.self) private var store
    let product: Product
    @State private var seed = ""
    @State private var result: SeoKeywordResult?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                TextField("Topic or seed keyword (empty = product name)", text: $seed).textFieldStyle(.roundedBorder).onSubmit(run)
                Button(action: run) { if busy { ProgressView().controlSize(.small) } else { Text("Find keywords") } }
                    .buttonStyle(.borderedProminent).disabled(busy)
            }
            .padding([.horizontal, .top], 20)
            if let r = result {
                if !r.measured {
                    Label("Estimates, not search data. These terms come from your knowledge base: they show what you already say, not how often people search for it.",
                          systemImage: "exclamationmark.triangle")
                        .font(.callout).foregroundStyle(.orange).padding(.horizontal, 20)
                }
                Table(r.keywords) {
                    TableColumn("Keyword", value: \.keyword)
                    TableColumn("Intent", value: \.intent)
                    TableColumn("Source") { k in StatusPill(text: k.isEstimate ? "estimate" : k.source) }
                    TableColumn("Volume / clicks") { k in Text((k.clicks ?? k.volume).map(String.init) ?? "—").monospacedDigit() }
                    TableColumn("Difficulty / position") { k in
                        Text(k.position.map { String(format: "%.1f", $0) } ?? k.difficulty.map(String.init) ?? "—").monospacedDigit()
                    }
                }
            } else {
                ContentUnavailableView("Find keywords worth writing for", systemImage: "text.magnifyingglass",
                    description: Text("Without a keyword provider Aurora mines terms from your own knowledge base and labels them as estimates."))
            }
        }
    }

    private func run() {
        guard let c = store.client else { return }
        busy = true
        Task {
            defer { busy = false }
            do { result = try await c.seoKeywords(productId: product.id, seed: seed) } catch { store.handle(error) }
        }
    }
}

private struct ScorePane: View {
    @Environment(AppStore.self) private var store
    let product: Product
    @State private var drafts: [Artifact] = []
    @State private var selected: String?
    @State private var keyword = ""
    @State private var result: SeoScore?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if drafts.isEmpty {
                ContentUnavailableView("No content drafts yet", systemImage: "doc.text",
                    description: Text("Generate an article in the web console (content type seo_article or blog), then score it here."))
            } else {
                HStack {
                    Picker("Draft", selection: $selected) {
                        ForEach(drafts) { Text(($0.title ?? "Untitled") + " · " + $0.status).tag(Optional($0.id)) }
                    }.frame(maxWidth: 300)
                    TextField("Target keyword", text: $keyword).textFieldStyle(.roundedBorder).onSubmit(run)
                    Button(action: run) { if busy { ProgressView().controlSize(.small) } else { Text("Score draft") } }
                        .buttonStyle(.borderedProminent).disabled(keyword.isEmpty || selected == nil || busy)
                }
                .padding([.horizontal, .top], 20)
                if let r = result {
                    HStack(alignment: .top, spacing: 22) {
                        ScoreBadge(score: r.score)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(r.metaTitle).font(.headline).foregroundStyle(Color.accentColor)
                            Text(r.metaDescription).font(.callout).foregroundStyle(.secondary)
                            Text(r.components.sorted { $0.key < $1.key }.map { "\($0.key) \($0.value)" }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 20)
                    List(r.suggestions, id: \.self) { Label($0, systemImage: "lightbulb") }
                    Text("Scoring saves the meta text with the draft. An already-approved draft goes back to draft so a reviewer approves the new meta too.")
                        .font(.footnote).foregroundStyle(.secondary).padding(.horizontal, 20).padding(.bottom, 12)
                }
            }
        }
        .task(id: product.id) {
            guard let c = store.client else { return }
            do {
                drafts = try await c.artifacts(productId: product.id).filter { $0.type == "content" }
                selected = selected ?? drafts.first?.id
            } catch { store.handle(error) }
        }
    }

    private func run() {
        guard let c = store.client, let id = selected else { return }
        busy = true
        Task {
            defer { busy = false }
            do { result = try await c.seoScore(artifactId: id, keyword: keyword) } catch { store.handle(error) }
        }
    }
}
