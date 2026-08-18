import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.akitokosumoto.parkingassist',
  appName: '精算機補助',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
