// One-shot Spotify authorization. Prints the URL, catches the callback, and
// prints the refresh token. Writes nothing to disk.
// Re-run it every 6 months: Spotify expires refresh tokens after 6 months, and
// refreshing the access token does not extend the refresh token's life.
import { createServer } from 'node:http'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT = process.env.SPOTIFY_REDIRECT || 'http://127.0.0.1:8888/callback'
const SCOPES = 'user-read-currently-playing user-read-playback-state'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first')
  process.exit(1)
}

const redirect = new URL(REDIRECT)
const port = Number(redirect.port) || 8888

const authorize = new URL('https://accounts.spotify.com/authorize')
authorize.searchParams.set('client_id', CLIENT_ID)
authorize.searchParams.set('response_type', 'code')
authorize.searchParams.set('redirect_uri', REDIRECT)
authorize.searchParams.set('scope', SCOPES)

console.log(`Add this exact redirect URI to the app in the Spotify dashboard:\n  ${REDIRECT}\n`)
console.log('Open this URL, approve access, and come back here:\n')
console.log(authorize.toString())
console.log(`\nlistening on port ${port} …`)

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT)
  if (url.pathname !== redirect.pathname) {
    res.statusCode = 404
    res.end('not the callback')
    return
  }
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (error || !code) {
    res.end(`authorization failed: ${error || 'no code'}`)
    done(1)
    return
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
    }),
  })
  const data = await tokenRes.json().catch(() => null)
  if (!tokenRes.ok || !data?.refresh_token) {
    res.end('token exchange failed — see the terminal')
    console.error(tokenRes.status, data?.error || data?.error_description || 'no refresh_token')
    done(1)
    return
  }

  res.end('done — check the terminal')
  console.log(`\nSPOTIFY_REFRESH_TOKEN=${data.refresh_token}`)
  console.log(`scopes granted: ${data.scope || '(none)'}`)
  console.log('\nSet it in Vercel as SPOTIFY_REFRESH_TOKEN (Production), next to')
  console.log('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET, then redeploy.')
  console.log('\nRe-run this script in 6 months: Spotify expires refresh tokens after six')
  console.log('months, and refreshing the access token does not extend that.')
  done(0)
})

function done(code) {
  server.close()
  setTimeout(() => process.exit(code), 50)
}

server.listen(port, '127.0.0.1')
