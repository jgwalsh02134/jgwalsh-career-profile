import React, { useEffect, useMemo, useState } from 'react'
import { Search, Grid, List, Star, StarOff, MoreHorizontal, ExternalLink, Github } from 'lucide-react'

type Project = {
  id: string; title: string; summary?: string; status?: string;
  category?: string[]; tags?: string[]; lastUpdated?: string; thumbnail?: string;
  links?: Record<string,string>;
}
type ProjectsJson = { projects: Project[] }

const statusClass: Record<string,string> = {
  live:'bg-emerald-50 text-emerald-700 border-emerald-200',
  beta:'bg-amber-50 text-amber-700 border-amber-200',
  alpha:'bg-slate-50 text-slate-700 border-slate-200',
  idea:'bg-zinc-50 text-zinc-700 border-zinc-200'
}
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined,{month:'short',day:'2-digit',year:'numeric'}) : ''

export default function ProjectsHub({ jsonUrl = '/static/data/projects.json' }:{jsonUrl?: string}){
  const [data,setData] = useState<Project[]>([])
  const [loading,setLoading] = useState(true)
  const [err,setErr] = useState<string|null>(null)

  const [q,setQ] = useState(''); const [sort,setSort] = useState<'newest'|'oldest'|'az'>('newest')
  const [view,setView] = useState<'grid'|'list'>('grid'); const [cat,setCat] = useState(''); const [status,setStatus] = useState('')
  const [stars,setStars] = useState<Record<string,true>>(()=> { try{ return JSON.parse(localStorage.getItem('projects:favs')||'{}') }catch{ return {} } })

  useEffect(()=>{ let alive=true;(async()=>{
    try{ setLoading(true); const r=await fetch(jsonUrl,{cache:'no-store'}); if(!r.ok) throw new Error('load failed')
      const j:ProjectsJson=await r.json(); if(alive) setData(j.projects||[]) }
    catch(e:any){ if(alive) setErr(e?.message||'Failed to load projects') }
    finally{ if(alive) setLoading(false) }
  })(); return ()=>{ alive=false } },[jsonUrl])

  const categories = useMemo(()=>{ const s=new Set<string>(); data.forEach(p=>(p.category||[]).forEach(c=>s.add(c))); return [...s].sort() },[data])
  const statuses   = useMemo(()=>{ const s=new Set<string>(); data.forEach(p=>p.status&&s.add(p.status)); return [...s] },[data])

  const results = useMemo(()=>{ const needle=q.trim().toLowerCase()
    const filtered=data.filter(p=>!cat||(p.category||[]).includes(cat))
      .filter(p=>!status||(p.status||'').toLowerCase()===status.toLowerCase())
      .filter(p=>{ if(!needle) return true; const hay=[p.title,p.summary,...(p.tags||[]),...(p.category||[])].filter(Boolean).join(' ').toLowerCase(); return hay.includes(needle) })
      .sort((a,b)=>{ if(sort==='az') return a.title.localeCompare(b.title); const ad=new Date(a.lastUpdated||'1970-01-01').getTime(); const bd=new Date(b.lastUpdated||'1970-01-01').getTime(); return sort==='oldest'?ad-bd:bd-ad })
    const fav=filtered.filter(p=>!!stars[p.id]); const rest=filtered.filter(p=>!stars[p.id]); return fav.concat(rest)
  },[data,q,cat,status,sort,stars])

  function toggleStar(id:string){ setStars(prev=>{ const next={...prev}; if(next[id]) delete next[id]; else next[id]=true; localStorage.setItem('projects:favs',JSON.stringify(next)); return next }) }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Projects Hub</h1>
        <p className="text-neutral-500">From concept to impact.</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input aria-label="Search projects" placeholder="Search projects…" className="w-full rounded-lg border px-3 py-2 pl-9"
              value={q} onChange={(e)=>setQ(e.target.value)} />
          </div>
          <select className="rounded-lg border px-3 py-2" value={cat} onChange={(e)=>setCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 capitalize" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="">All status</option>
            {statuses.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className={`rounded border px-3 py-1 ${sort==='newest'?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>setSort('newest')}>Newest</button>
          <button className={`rounded border px-3 py-1 ${sort==='oldest'?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>setSort('oldest')}>Oldest</button>
          <button className={`rounded border px-3 py-1 ${sort==='az'?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>setSort('az')}>A → Z</button>
          <span className="mx-2 hidden h-6 w-px bg-neutral-200 md:block" />
          <button className={`inline-flex items-center gap-1 rounded border px-3 py-1 ${view==='grid'?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>setView('grid')}><List className="hidden" /> Grid</button>
          <button className={`inline-flex items-center gap-1 rounded border px-3 py-1 ${view==='list'?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>setView('list')}><List className="h-4 w-4" /> List</button>
        </div>
      </div>

      {loading ? <p className="text-neutral-500">Loading projects…</p>
       : err ? <p className="text-red-600">{err}</p>
       : results.length===0 ? <p className="text-neutral-500">No projects found.</p>
       : (
        <div className={view==='grid' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-4'}>
          {results.map(p => <Card key={p.id} p={p} view={view} starred={!!stars[p.id]} onToggleStar={()=>toggleStar(p.id)} />)}
        </div>
       )}
    </div>
  )
}

function Card({ p, view, starred, onToggleStar }:{ p:Project, view:'grid'|'list', starred:boolean, onToggleStar:()=>void }){
  const statusCls = p.status ? (statusClass[p.status]||'') : ''
  const Links = () => (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
      {p.links?.demo && <a className="inline-flex items-center gap-1 underline hover:no-underline" href={p.links.demo} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Demo</a>}
      {p.links?.repo && <a className="inline-flex items-center gap-1 underline hover:no-underline" href={p.links.repo} target="_blank" rel="noreferrer"><Github className="h-4 w-4" />Repo</a>}
      {p.links && Object.entries(p.links).filter(([k])=>k!=='demo' && k!=='repo').map(([k,v])=> <a key={k} className="underline hover:no-underline" href={v} target="_blank" rel="noreferrer">{k[0].toUpperCase()+k.slice(1)}</a>)}
    </div>
  )
  if(view==='list'){
    return (
      <div className="flex gap-4 rounded-2xl border p-4">
        {p.thumbnail ? <a href={p.links?.demo||'#'} target={p.links?.demo? '_blank': undefined} rel={p.links?.demo?'noreferrer': undefined}><img src={p.thumbnail} alt={`${p.title} thumbnail`} className="h-28 w-40 rounded-md object-cover" /></a> : <div className="h-28 w-40 rounded-md bg-neutral-100" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold leading-tight">{p.title}</h3>
              {p.summary && <p className="mt-1 text-sm text-neutral-600">{p.summary}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {p.status && <span className={`rounded border px-2 py-0.5 text-xs capitalize ${statusCls}`}>{p.status}</span>}
                {p.lastUpdated && <span className="rounded border px-2 py-0.5 text-xs">Updated {fmt(p.lastUpdated)}</span>}
              </div>
            </div>
            <div className="ml-3 flex items-center gap-1">
              <button className="rounded p-1 hover:bg-neutral-100" aria-label={starred?'Unstar project':'Star project'} onClick={onToggleStar}>{starred ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}</button>
              <button className="rounded p-1 hover:bg-neutral-100" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
          {(p.category?.length || p.tags?.length) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(p.category||[]).map(c => <span key={c} className="rounded-full border px-2 py-0.5 text-xs">{c}</span>)}
              {(p.tags||[]).slice(0,6).map(t => <span key={t} className="rounded-full border px-2 py-0.5 text-xs">{t}</span>)}
            </div>
          )}
          <Links />
        </div>
      </div>
    )
  }
  return (
    <article className="overflow-hidden rounded-2xl border">
      {p.thumbnail ? <a href={p.links?.demo||'#'} target={p.links?.demo? '_blank': undefined} rel={p.links?.demo?'noreferrer': undefined}><img src={p.thumbnail} alt={`${p.title} thumbnail`} className="h-40 w-full object-cover" /></a> : <div className="h-40 w-full bg-neutral-100" />}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{p.title}</h3>
          <div className="flex items-center gap-1">
            <button className="rounded p-1 hover:bg-neutral-100" aria-label={starred?'Unstar project':'Star project'} onClick={onToggleStar}>{starred ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}</button>
            <button className="rounded p-1 hover:bg-neutral-100" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
        {p.summary && <p className="text-sm text-neutral-600">{p.summary}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.status && <span className={`rounded border px-2 py-0.5 text-xs capitalize ${statusCls}`}>{p.status}</span>}
          {p.lastUpdated && <span className="rounded border px-2 py-0.5 text-xs">Updated {fmt(p.lastUpdated)}</span>}
        </div>
        {(p.category?.length || p.tags?.length) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(p.category||[]).map(c => <span key={c} className="rounded-full border px-2 py-0.5 text-xs">{c}</span>)}
            {(p.tags||[]).slice(0,4).map(t => <span key={t} className="rounded-full border px-2 py-0.5 text-xs">{t}</span>)}
          </div>
        )}
        <Links />
      </div>
    </article>
  )
}


