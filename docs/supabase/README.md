# Player accounts and best scores (Supabase)

Kids sign in with a **name and a 4 to 6 digit PIN**: no email, no password, nothing personal. Each game sends its score when a round ends, and the **🏆 Best scores** page (`scores.html`) shows each player's best and the top 10 of every game.

Until a Supabase project is filled in, nothing changes for the players: the Log in button stays hidden, and the Best scores page shows the bests kept on that device.

## Set it up (about 5 minutes)

1. Create a free account at [supabase.com](https://supabase.com) and click **New project**. Any name (say `kids-games`), any database password (you won't need it here), the region closest to you.
2. When the project is ready, open **SQL Editor → New query**, paste all of [`setup.sql`](setup.sql) and click **Run**. It should say *Success. No rows returned*.
3. Open **Project Settings → API Keys** and copy:
   - the **Project URL** (like `https://abcdefghijklmnop.supabase.co`; it is also on **Project Settings → Data API**),
   - the **publishable key** (`sb_publishable_…`). An older project shows the **anon public** key (`eyJ…`) instead: that works too.
4. Paste both into [`js/config.js`](../js/config.js) and publish the site as usual. Both are meant to be public: what anyone can do is decided by the database, below.

Nothing to set in **Authentication**: accounts don't use Supabase Auth or email.

## How it works

| Where | What |
| --- | --- |
| `js/config.js` | The Supabase project URL and public key. |
| `js/accounts.js` | Log in / new player, and `Accounts.submit(game, score, level)` for the games. |
| `js/scores.js`, `scores.html` | The Best scores page. |
| `supabase/setup.sql` | Tables, safety rules and the four functions the site calls. |

- **Tables.** `players` (name and PIN, the PIN hashed with bcrypt), `sessions` (one sign-in token per device) and `scores` (player, game, level, score, date). The view `best_scores` gives each player's best in each game.
- **Who can write.** Row-level security is on for every table. Anyone can read names and scores; nobody can write, change or delete anything directly. The site only calls `sign_up`, `log_in`, `log_out` and `add_scores`, and `add_scores` writes scores only for the player whose sign-in token it gets.
- **No cheating.** A score must be possible: Army Rush up to wave 12 (500 with 🏘️ Manage my city, which never ends), Blocks up to 200 000 points, Jumpy Frog up to 2 000 rocks, Copy Me up to 100, Odd One Out up to 10 stars. Anything else, or a game the database doesn't know, is skipped.
- **Guessing PINs.** After 5 wrong PINs in a row a name is locked for 10 minutes.
- **Signed out.** Every score is kept on the device first. Scores made signed out (or with no internet) are sent the next time someone signs in on that device. The page also shows the best scores of that device.

## Scores in a game

Games with a score load `js/config.js` and `js/accounts.js`, and call this when a round ends:

```js
Accounts.submit("jump", score);               // a game with no levels
Accounts.submit("army", wave, "hard-city");   // with its level
```

To add a game: give it a line in the `score_is_plausible` check in `setup.sql` (and run that change in the SQL Editor), and in the `GAMES` list at the top of `js/accounts.js`.

## Look after it

- **See or fix scores:** **Table Editor** in Supabase. Deleting a player there deletes their scores too.
- **A forgotten PIN:** delete the player in **Table Editor → players**, and they pick the name again.
- **Free plan:** a project that nobody uses for a week is paused; open it in Supabase and click **Restore**.
