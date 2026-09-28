import React from 'react'
import { createRoot } from 'react-dom/client'
import Kok from './Kok.jsx'
import Kapi from './giris/Kapi.jsx'
import './stil.css'

createRoot(document.getElementById('root')).render(<Kapi><Kok /></Kapi>)
