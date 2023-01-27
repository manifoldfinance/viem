import { expect, test } from 'vitest'

import * as actions from './index'

test('exports actions', () => {
  expect(actions).toMatchInlineSnapshot(`
    {
      "addChain": [Function],
      "getAccounts": [Function],
      "getPermissions": [Function],
      "requestAccounts": [Function],
      "requestPermissions": [Function],
      "sendTransaction": [Function],
      "signMessage": [Function],
      "switchChain": [Function],
      "watchAsset": [Function],
    }
  `)
})