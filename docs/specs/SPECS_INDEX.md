# FSRS Specs Index

This file tracks all specifications for the @squeakyrobot/fsrs library, including their implementation status and dates.

## Implemented Specs ✅

| Spec | Date Created | Implementation Date | Status | Notes |
|------|-------------|-------------------|--------|-------|
| [FSRS v4.5 Implementation](implemented/2025-12-07_fsrs-v4.5-implementation.md) | 2025-12-07 | 2025-12-08 | ✅ Complete | Core v4.5 algorithm with v6 compatibility. 147 tests passing. |

## In Progress 🚧

| Spec | Date Created | Assigned | Status | Notes |
|------|-------------|----------|--------|-------|
| *No specs in progress* | - | - | - | - |

## Planned 📋

| Spec | Date Created | Priority | Dependencies | Notes |
|------|-------------|----------|-------------|-------|
| [Future Enhancements](planned/2025-12-07_future-enhancements.md) | 2025-12-07 | Medium | v1.0 Complete | Post-v1.0 features: AutoRatingConfig, analytics utilities, parameter optimizer, migration tools |

## Not Implemented / Future 🔮

| Spec | Date Created | Reason | Notes |
|------|-------------|--------|-------|
| *No future specs yet* | - | - | - |

## Archived 📦

| Spec | Date Created | Date Archived | Reason | Replacement |
|------|-------------|---------------|--------|-------------|
| *No archived specs yet* | - | - | - | - |

---

## Spec Guidelines

### Creating New Specs
1. **Date Format**: Use `YYYY-MM-DD_feature-name.md` for filenames
2. **Status Tracking**: Update this index when creating/updating specs
3. **Implementation Flow**: planned → in-progress → implemented
4. **Dependencies**: Note any spec dependencies in the planned section

### File Structure
```
docs/specs/
├── SPECS_INDEX.md (this file)
├── implemented/    # Completed and deployed features
├── in-progress/    # Currently being worked on
├── planned/        # Ready for implementation
├── archived/       # Superseded or cancelled specs
└── not-implemented/ # Future/low-priority specs
```

### Status Definitions
- **✅ Complete**: Fully implemented, tested, and documented
- **🚧 In Progress**: Active development underway
- **📋 Planned**: Approved for implementation, waiting for resources
- **🔮 Future**: Identified need, not yet prioritized
- **📦 Archived**: No longer relevant or superseded
