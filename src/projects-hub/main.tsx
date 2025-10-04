import React from 'react'
import { createRoot } from 'react-dom/client'
import ProjectsHub from './ProjectsHub'
const el = document.getElementById('projects-root')
if(el){ createRoot(el).render(<ProjectsHub />) }
