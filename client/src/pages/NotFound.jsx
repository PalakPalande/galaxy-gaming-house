import { Link } from 'react-router-dom'
export default function NotFound(){
  return <main className="page container"><div className="glass-card cta"><span className="eyebrow">404 • LOST IN SPACE</span><h2>Page not found</h2><p>The route you opened does not exist.</p><Link className="btn" to="/">Return home</Link></div></main>
}
