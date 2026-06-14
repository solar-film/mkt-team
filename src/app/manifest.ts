import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MKT-GFS',
    short_name: 'MKT-GFS',
    description: 'ระบบติดตามทีมการตลาดและคอนเท้น',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icon.png?v=3',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon512.png?v=3',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
