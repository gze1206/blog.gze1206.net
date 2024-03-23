using backend.Models;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("[controller]")]
public class PostController : ControllerBase
{
    private readonly ILogger<PostController> logger;
    private readonly AppDbContext dbContext;

    public PostController(ILogger<PostController> logger, AppDbContext dbContext)
    {
        this.logger = logger;
        this.dbContext = dbContext;
    }

    [HttpGet("")]
    public Task<PostContext> GetTestPost()
    {
        return Task.FromResult(new PostContext(
            Slug: "test-post",
            Title: "Test Post",
            Markdown: "# H1\n## H2\nbody\n- list item 1\n- list item 2",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow));
    }
}