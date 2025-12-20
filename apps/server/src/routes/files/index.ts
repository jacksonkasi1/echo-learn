// ** import lib
import { Hono } from 'hono'

// ** import routes
import { deleteRoute } from './delete-file'
import { listRoute } from './list-files'
import { getRoute } from './get-file'

const files = new Hono()

files.route('/', deleteRoute)
files.route('/', listRoute)
files.route('/', getRoute)

export { files as filesRoute }

