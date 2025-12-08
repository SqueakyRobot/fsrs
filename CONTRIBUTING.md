# Contributing to @squeakyrobot/fsrs

First off, thank you for considering contributing to @squeakyrobot/fsrs! This project aims to provide a robust, well-tested spaced repetition scheduling library, and community contributions help make it better for everyone.

## Important Note

This is a personal project maintained by a single developer in their spare time. While I deeply appreciate all contributions, please understand that:

- **Response times may vary** - I have a full-time job and other projects, so reviews and responses will be on a best-effort basis
- **Not all features may be accepted** - The project has a specific scope and vision focused on providing a minimal, production-ready FSRS implementation
- **Patience is appreciated** - It might take days or even weeks to review PRs

That said, your contributions are valued, and I'll do my best to review and respond when possible!

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**To report a bug:**

1. Use a clear and descriptive title
2. Describe the exact steps to reproduce the problem
3. Provide specific examples to demonstrate the steps
4. Describe the behavior you observed and what you expected
5. Include your environment details (TypeScript version, runtime environment, Node.js/Deno/Bun version)
6. Include the FSRS version you're using

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:

1. Use a clear and descriptive title
2. Provide a detailed description of the proposed feature
3. Explain why this enhancement would be useful
4. Consider if it aligns with the project's goal of being a minimal, focused implementation
5. If possible, provide code examples of how it would work

**Note**: The project prioritizes simplicity and correctness over feature completeness. Enhancements that significantly increase complexity may be declined.

### Pull Requests

**Before starting work:**

1. Check if there's already an issue discussing the change
2. For significant changes, open an issue first to discuss the idea
3. For small fixes (typos, obvious bugs), you can submit a PR directly
4. Review the [specification document](doc/specs/in-progress/2025-12-07_fsrs-v4.5-implementation.md) to understand the project architecture

**Pull Request Process:**

1. Fork the repository and create your branch from `main`
2. Make your changes following the code style guidelines
3. Add tests for any new functionality
4. Ensure all tests pass by running `npm test`
5. Update documentation if needed
6. Create a pull request with a clear title and description

## Code Style Guidelines

- Follow the existing code style in the project
- Use TypeScript's strict mode features
- Write clear, self-documenting code with comments where necessary
- Keep functions focused and small
- Use meaningful variable and function names
- Prefer pure functions without side effects
- Maintain immutability - never mutate input parameters

### Language Standards

All code, documentation, and comments must be written as if they represent the final, complete version of the system:

- **Avoid temporal language**: Don't use "new", "added", "enhanced", "updated", etc.
- **State functionality directly**: "Supports X" not "Now supports X"
- **No version comparisons**: Don't reference "v1.5" or "since v2.0" in comments
- **Focus on behavior**: Describe what code does, not when it was written

## Testing

- Write tests for any new functionality
- Ensure all existing tests pass
- Follow the existing test patterns in the `__tests__` directory
- Aim for clarity in test descriptions
- Test edge cases and error conditions
- Validate against the FSRS specification test vectors when applicable

## Documentation

- Update the relevant documentation files if your change affects usage
- Use clear, concise language
- Include code examples where appropriate
- Keep the same documentation style as existing files
- Follow the API documentation format used in README.md
- Update the specification document if implementing planned features

## What to Work On

If you're looking for ways to contribute:

1. **Bug fixes** - Always welcome!
2. **Test coverage** - Additional test cases for edge cases
3. **Documentation improvements** - Clarifications, examples, typo fixes
4. **Performance optimizations** - With benchmarks showing improvements
5. **Algorithm correctness** - Fixes that improve adherence to FSRS specification

**Areas that need less attention:**

- Feature additions beyond the FSRS v4.5/v6 specification
- Alternative scheduling algorithms
- UI/visualization components (this is a library, not an app)

## Project Structure

```
/src
  models.ts       - Type definitions
  algorithm.ts    - Core FSRS formulas (pure functions)
  parameters.ts   - Default weights and parameter management
  scheduler.ts    - Main FSRS class
  index.ts        - Public API exports

/__tests__
  algorithm.test.ts    - Unit tests for formulas
  scheduler.test.ts    - FSRS class tests
  parameters.test.ts   - Parameter validation tests
  integration.test.ts  - Full algorithm integration tests

/doc
  /specs          - Implementation specifications
```

## Development Commands

```bash
npm install     # Install dependencies
npm run build   # Build TypeScript to dist/
npm run dev     # Watch mode for development
npm run test    # Run test suite
npm test:watch  # Watch mode for tests
npm run coverage # Generate test coverage report
npm run clean   # Remove dist directory
```

## Questions?

Feel free to open an issue with your question. I'll respond when I can!

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

Thank you again for your interest in contributing. Even if I can't respond immediately, know that your effort to improve the project is appreciated!
