import type { Address } from 'abitype'

import { getChainId } from '../../../actions/public/getChainId.js'
import {
  type ReadContractErrorType,
  readContract,
} from '../../../actions/public/readContract.js'
import {
  type PrepareTransactionRequestErrorType,
  type PrepareTransactionRequestParameters,
  prepareTransactionRequest,
} from '../../../actions/wallet/prepareTransactionRequest.js'
import type { Client } from '../../../clients/createClient.js'
import type { Transport } from '../../../clients/transports/createTransport.js'
import { maxInt256 } from '../../../constants/number.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { Account, GetAccountParameter } from '../../../types/account.js'
import { type Chain, type GetChainParameter } from '../../../types/chain.js'
import type { Signature } from '../../../types/misc.js'
import type { TransactionRequestEIP1559 } from '../../../types/transaction.js'
import type { RequestErrorType } from '../../../utils/buildRequest.js'
import { getChainContractAddress } from '../../../utils/chain/getChainContractAddress.js'
import { type HexToNumberErrorType } from '../../../utils/encoding/fromHex.js'
import { numberToHex } from '../../../utils/encoding/toHex.js'
import {
  type AssertRequestErrorType,
  assertRequest,
} from '../../../utils/transaction/assertRequest.js'
import {
  type SerializeTransactionErrorType,
  serializeTransaction,
} from '../../../utils/transaction/serializeTransaction.js'
import { gasPriceOracleAbi } from '../abis.js'
import { contracts } from '../contracts.js'

export type EstimateL1GasParameters<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = Omit<TransactionRequestEIP1559, 'from'> &
  GetAccountParameter<TAccount> &
  GetChainParameter<TChain, TChainOverride> & {
    /** Gas price oracle address. */
    gasPriceOracleAddress?: Address
  }

export type EstimateL1GasReturnType = bigint

export type EstimateL1GasErrorType =
  | RequestErrorType
  | PrepareTransactionRequestErrorType
  | AssertRequestErrorType
  | SerializeTransactionErrorType
  | HexToNumberErrorType
  | ReadContractErrorType
  | ErrorType

const stubSignature = {
  r: numberToHex(maxInt256),
  s: numberToHex(maxInt256),
  v: 28n,
} as const satisfies Signature

/**
 * Estimates the L1 data gas required to execute an L2 transaction.
 *
 * @param client - Client to use
 * @param parameters - {@link EstimateL1GasParameters}
 * @returns The gas estimate. {@link EstimateL1GasReturnType}
 *
 * @example
 * import { createPublicClient, http, parseEther } from 'viem'
 * import { optimism } from 'viem/chains'
 * import { estimateL1Gas } from 'viem/chains/optimism'
 *
 * const client = createPublicClient({
 *   chain: optimism,
 *   transport: http(),
 * })
 * const l1Gas = await estimateL1Gas(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: parseEther('1'),
 * })
 */
export async function estimateL1Gas<
  TChain extends Chain | undefined,
  TAccount extends Account | undefined,
  TChainOverride extends Chain | undefined = undefined,
>(
  client: Client<Transport, TChain, TAccount>,
  args: EstimateL1GasParameters<TChain, TAccount, TChainOverride>,
): Promise<EstimateL1GasReturnType> {
  const {
    chain = client.chain,
    gasPriceOracleAddress: gasPriceOracleAddress_,
  } = args

  const gasPriceOracleAddress = (() => {
    if (gasPriceOracleAddress_) return gasPriceOracleAddress_
    if (chain)
      return getChainContractAddress({
        chain,
        contract: 'gasPriceOracle',
      })
    return contracts.gasPriceOracle.address
  })()

  // Populate transaction with required fields to accurately estimate gas.
  const [request, chainId] = await Promise.all([
    prepareTransactionRequest(
      client,
      args as PrepareTransactionRequestParameters,
    ),
    (async () => {
      if (chain) return chain.id
      return getChainId(client)
    })(),
  ])

  assertRequest(request)

  const transaction = serializeTransaction(
    {
      ...request,
      chainId,
      type: 'eip1559',
    },
    stubSignature,
  )

  return readContract(client, {
    abi: gasPriceOracleAbi,
    address: gasPriceOracleAddress,
    functionName: 'getL1GasUsed',
    args: [transaction],
  })
}
