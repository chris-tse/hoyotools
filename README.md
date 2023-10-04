# Hoyo Reward Claimer

Simple script to claim HSR and Genshin daily web login rewards.

## Requirements
- Node.js v13.2 or higher

## Usage
- Create a `.env` at the root with the following fields:
  ```env
  COOKIE=""
  HSR_UID=""
  GENSHIN_UID=""
  ```
- Follow [these instructions](https://github.com/vermaysha/hoyoapi#how-to-obtain-hoyolab-cookie) to populate the `COOKIE` variable
- Fill in the respective game UIDs
- Install dependencies using package manager of your choice:
  ```bash
  # whichever you have installed
  npm install
  yarn install
  pnpm install
  ```
- Run the script:
  ```bash
  node index.mjs
  ```
