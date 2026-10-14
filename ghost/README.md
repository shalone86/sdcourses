# Ghost setup (one time, until the new theme ships)

Until the new theme builds the quiz in, paste this into
**Settings → Code injection**:

- **Site header**: `<style>` + the contents of `quiz.css` + `</style>`
- **Site footer**: `<script>` + the contents of `quiz.js` + `</script>`

(`npm run post` writes a ready-to-paste `dist/code-injection.html` with both.)

Then create a custom integration (**Settings → Integrations → Add custom
integration**) and copy its Admin API key for `npm run publish`.
