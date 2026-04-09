# GitHub Extension Scripts

A collection of [Greasemonkey](https://www.greasespot.net/)/[Tampermonkey](https://www.tampermonkey.net/) userscripts that enhance GitHub.

## Scripts

### Mark All Notifications Done

[`github-mark-all-done.user.js`](github-mark-all-done.user.js)

<img width="320" height="126" alt="screenshot1" src="https://github.com/user-attachments/assets/f1619859-538c-4858-ba2a-422bb277fefb" />
<br />
<img width="320" height="126" alt="screenshot2" src="https://github.com/user-attachments/assets/488830f9-8424-48cc-ab9a-121caa7b3514" />

Adds a **"Mark all as done"** button to GitHub notification groups. GitHub's notifications page only shows a limited number of notifications per repository group — this script marks **all** of them as done, including the hidden, paginated ones.

**How it works:** On the [GitHub notifications page](https://github.com/notifications) (grouped by repository), each group gets a "Mark all as done" button. Clicking it fetches all pages of notifications for that repository, submits the "Done" action for each one, and removes the group from the page.

---

### PR Reviewed Files Copier

[`github-reviewed-files.user.js`](github-reviewed-files.user.js)

![screenshot](https://github.com/user-attachments/assets/bb6bd2dc-3157-4c66-b075-9509572d8bbd)

Adds a dropdown next to the **"X / Y viewed"** counter on PR "Files changed" pages, letting you copy a plain-text list of viewed or unviewed file paths to your clipboard.

**How it works:** Reads file paths and viewed state from React's internal fiber tree (`file.diff.markedAsViewed`) on the file tree sidebar. Works on large PRs where GitHub lazily loads diffs.

---

### PR Hide Viewed Files

[`github-hide-viewed-files.user.js`](github-hide-viewed-files.user.js)

Adds a **"Hide viewed files"** toggle to the diff settings dropdown (gear icon) on PR "Files changed" pages. When enabled, viewed/collapsed file diffs are hidden from the diff list and viewed files are removed from the sidebar file tree, giving you a cleaner view of only the files left to review.

**How it works:** Tags each virtualized diff row based on its "Viewed" button state (`aria-pressed`) and each sidebar tree item via React fiber (`file.diff.markedAsViewed`). A CSS rule collapses tagged rows and hides tagged tree items when the toggle is active. State is persisted in `sessionStorage`.

---

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
2. Open Tampermonkey/Greasemonkey, create a new script, and copy-paste the contents of whichever `.user.js` file you want.

## License

MIT
