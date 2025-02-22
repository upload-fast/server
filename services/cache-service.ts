// import { BentoCache, bentostore } from 'bentocache'
// import { memoryDriver } from 'bentocache/drivers/memory'

// export const bento = new BentoCache({
//     default: 'myCache',
//     stores: {
//         // A first cache store named "myCache" using 
//         // only L1 in-memory cache
//         myCache: bentostore()
//             .useL1Layer(memoryDriver({ maxSize: '100mb' })),
//     },
//     plugins: []
// })

// export const UserCache = bento.namespace('users')
// export const AppCache = bento.namespace('apps')
