// ** import lib
import { Hono } from 'hono'

// ** import routes
import { chatRoute } from './completions'

const chat = new Hono()

chat.route('/', chatRoute)

export { chat as chatRoute }

