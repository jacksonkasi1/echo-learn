// ** import lib
import { Hono } from 'hono'

// ** import routes
import { ingestRoute } from './process'
import { statusRoute } from './status'

const ingest = new Hono()

ingest.route('/', ingestRoute)
ingest.route('/', statusRoute)

export { ingest as ingestRoute }
