import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

export const bento = new BentoCache({
    default: 'dataCache',
    stores: {
        dataCache: bentostore()
            .useL1Layer(memoryDriver({ maxSize: '100mb' })),
    },
})

bento.on('cache:hit', ({ key, value, store }) => {
    console.log(`cache:hit: ${key}, value ${value}, store ${store}`)
})

bento.on('cache:miss', ({ key, store }) => {
    console.log(`cache:miss: ${key}, store ${store}`)
})

export const UserCache = bento.namespace('users')
export const AppCache = bento.namespace('apps')
export const KeyCache = bento.namespace('keys')
