# Milestone Plan for Discord Whitelist Project

## Current Implementation Details

- Loader script in Tampermonkey that fetches and executes `whitelist.js` from `https://localhost:5173/`.
- Local HTTPS development setup using `mkcert` and `http-server`.
- Storage adapter implemented with preference order: page `localStorage` → Tampermonkey storage (`GM_*`) → memory fallback.
- Developer API exposed on `window.WL` with functions: `getState`, `setState`, `resetState`, `addToWhitelist`, `removeFromWhitelist`, `clearWhitelist`.
- Verified console logging, versioning, and `[WL]` debug prefix.
- State persists correctly when using Tampermonkey storage backend.

## Milestone 1: Initial Setup and Basic Functionality

- Set up the project repository and environment.
- Implement basic Discord bot connection using discord.js.
- Create a command to add users to the whitelist.
- Store whitelist data in a simple JSON file.

## Milestone 2: Persistent Storage and Validation

- Replace JSON file storage with a database (e.g., SQLite or MongoDB).
- Implement validation to prevent duplicate whitelist entries.
- Add command to remove users from the whitelist.
- Add command to list all whitelisted users.

## Milestone 3: Enhanced Bot Features

- Implement role-based access control for whitelist commands.
- Add logging for whitelist changes.
- Implement error handling and user feedback for commands.
- Add a command to check if a user is whitelisted.

## Milestone 4: Deployment and Testing

- Prepare the bot for deployment (environment variables, config files).
- Deploy the bot to a cloud service or server.
- Write tests for bot commands and database interactions.
- Conduct user testing and gather feedback.

## Milestone 5: Documentation and Finalization

- Write comprehensive documentation for setup and usage.
- Create a troubleshooting guide.
- Optimize code and refactor as needed.
- Plan for future features and maintenance.
