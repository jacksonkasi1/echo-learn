import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Bun will use this when you run `bun run dev` / `bun run index.ts`
export default {
  port: 8787,
  fetch: app.fetch,
}
