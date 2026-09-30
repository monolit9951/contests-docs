import { describe, expect, it } from 'vitest'
import { rootLinkPaths } from './markdown-links.mjs'

describe('the site-root links of a Markdown source', () => {
  it('judges a link by its path, without the query that opens the sign-up dialog or a fragment', () => {
    expect(rootLinkPaths('[Начать](/tasks?auth=signup) и [гайд](/zarabotok/kak-delat-narezki#setup).')).toEqual(['/tasks', '/zarabotok/kak-delat-narezki'])
    expect(rootLinkPaths('[EN](/en/tasks?auth=signup "Sign up")')).toEqual(['/en/tasks'])
  })

  it('leaves out every link that is not site-root relative', () => {
    expect(rootLinkPaths('[chat](https://t.me/darebaycreatorschat) [anchor](#faq) [rel](../x) ![img](/img.png)')).toEqual(['/img.png'])
  })
})
