import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TeamTracker',
    short_name: 'TeamTracker',
    description: 'ระบบติดตามทีมการตลาดและคอนเท้น',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
