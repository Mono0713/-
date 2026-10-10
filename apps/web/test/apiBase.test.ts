import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { looksLikeWebPage, modelsAt } from '../src/features/settings/apiBase'

// A service whose API lives at /v1 and whose other pages are HTML.
const server = createServer((req, res) => {
  if (req.url === '/v1/models') return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ object: 'list', data: [{ id: 'm-1', object: 'model' }] }))
  res.writeHead(200, { 'content-type': 'text/html' }).end('<html>keys</html>')
})
let origin = ''
beforeAll(() => new Promise<void>((done) => server.listen(0, () => ((origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`), done()))))
afterAll(() => server.close())

describe('modelsAt', () => {
  it('finds the /v1 address when a web page was pasted', async () => {
    expect(await modelsAt(`${origin}/keys`, 'k')).toEqual({ known: ['m-1'], baseUrl: `${origin}/v1` })
  })
  it('keeps a working address', async () => {
    expect(await modelsAt(`${origin}/v1`, 'k')).toEqual({ known: ['m-1'], baseUrl: `${origin}/v1` })
  })
  it('tells web pages from API addresses', () => {
    expect(looksLikeWebPage('https://www.cun.ai/keys')).toBe(true)
    expect(looksLikeWebPage('https://api.x.ai/v1')).toBe(false)
  })
})
