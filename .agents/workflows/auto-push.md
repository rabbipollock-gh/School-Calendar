---
description: Auto-commit and push all code changes to GitHub after every edit
---

// turbo-all

After making ANY code changes to the project, always run the following steps automatically:

1. Stage all changed files:
```
git add .
```

2. Commit with a descriptive message summarizing what was changed:
```
git commit -m "✏️ [short description of what was changed]"
```

3. Push to GitHub:
```
git push
```

Always run this after completing any code edits. The commit message should briefly describe the feature, fix, or change made.
