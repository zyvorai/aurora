import Foundation

public struct TokenResponse: Codable, Sendable, Equatable {
    public let accessToken: String
    public let tenantId: String
    public let userId: String
    public let role: String
}

public struct Product: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let name: String
    public let websiteUrl: String?
    public let description: String?
    public let profileStatus: String
    public let createdAt: String
}

public struct Artifact: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let type: String
    public let title: String?
    public let status: String
    public let channel: String?
    public let createdAt: String
}

public struct WorkflowStep: Codable, Sendable, Hashable {
    public let name: String
    public let status: String
    public let error: String?
}

public struct WorkflowRun: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let workflowName: String
    public let status: String
    public let steps: [WorkflowStep]
    public let errorMessage: String?
    public let startedAt: String?
    public let completedAt: String?
    public let createdAt: String?

    public var isActive: Bool { status == "running" || status == "queued" }
}

public struct AuditEntry: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let action: String
    public let resourceType: String
    public let resourceId: String?
    public let createdAt: String
}

public struct AgentEntry: Codable, Sendable, Identifiable, Hashable {
    public let agentId: String
    public let displayName: String
    public let computeTier: String
    public let asyncRequired: Bool
    public let implemented: Bool
    public let modelKey: String
    public let description: String
    public var id: String { agentId }
}

public struct ApprovalResponse: Codable, Sendable { public let status: String }

public struct PublishResponse: Codable, Sendable {
    public let channelPostId: String
    public let status: String
}

// MARK: SEO

public struct SeoFinding: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let severity: String   // critical | warning | info
    public let message: String
    public let fix: String
}

public struct SeoAudit: Codable, Sendable, Hashable {
    public let url: String
    public let score: Int
    public let title: String
    public let metaDescription: String
    public let canonical: String
    public let wordCount: Int
    public let images: Int
    public let imagesMissingAlt: Int
    public let internalLinks: Int
    public let externalLinks: Int
    public let hasOpenGraph: Bool
    public let jsonldTypes: [String]
    public let findings: [SeoFinding]
}

public struct SeoKeyword: Codable, Sendable, Identifiable, Hashable {
    public let keyword: String
    public let intent: String
    /// `estimate` = mined from the knowledge base, not measured search data.
    public let source: String
    public let volume: Int?
    public let difficulty: Int?
    public let clicks: Int?
    public let impressions: Int?
    public let position: Double?
    public var id: String { keyword }
    public var isEstimate: Bool { source == "estimate" }
}

public struct SeoKeywordResult: Codable, Sendable {
    public let provider: String
    public let measured: Bool
    public let keywords: [SeoKeyword]
}

public struct SeoScore: Codable, Sendable {
    public let targetKeyword: String
    public let metaTitle: String
    public let metaDescription: String
    public let score: Int
    public let components: [String: Int]
    public let suggestions: [String]
}

public struct SeoProviderInfo: Codable, Sendable, Hashable {
    public let configured: Bool
    public let measured: Bool
    public let note: String
}

public struct SeoProviders: Codable, Sendable {
    public let `default`: String
    public let providers: [String: SeoProviderInfo]
}

public let publishChannels = ["email", "newsletter", "linkedin", "x", "medium", "devto", "reddit", "blog", "wordpress"]
