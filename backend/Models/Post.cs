namespace backend.Models;

public record PostContext(string Slug, string Title, string Markdown, DateTime CreatedAt, DateTime UpdatedAt);