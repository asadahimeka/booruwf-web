import { release } from '@himeka/release'

release({
  gitAdd: true,
  gitTag: false,
  skipBuild: true
}).catch((err) => {
  console.error(err)
})
