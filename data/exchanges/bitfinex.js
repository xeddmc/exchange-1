/* https://bitfinex.readme.io/v2/reference#rest-public-trades */
/* List of tickers: https://api.bitfinex.com/v1/symbols */

const request = require('request')
const lo = require('lodash')
const Decimal = require('decimal.js')

const supportedTickers = ["btcusd","ltcusd","ltcbtc","ethusd","ethbtc","etcbtc","etcusd","rrtusd","rrtbtc","zecusd","zecbtc","xmrusd","xmrbtc","dshusd","dshbtc","bccbtc","bcubtc","bccusd","bcuusd","xrpusd","xrpbtc","iotusd","iotbtc","ioteth","eosusd","eosbtc","eoseth","sanusd","sanbtc","saneth","omgusd","omgbtc","omgeth","bchusd","bchbtc","bcheth"]

function marketToSupported(market) {
  const _1 = market.first.toLowerCase()
  const _2 = market.second.toLowerCase()

  const tickers = lo.filter(supportedTickers, (t)=>{ return t.indexOf(_1) >= 0 && t.indexOf(_2) >= 0 })

  if (tickers.length == 0) return

  const tickerOfInterest = tickers[0]

  return [tickerOfInterest, tickerOfInterest.indexOf(_1) != 0]
}

function getOrderBook(market) {
  const tickerInfo = marketToSupported(market)

  return new Promise((resolve, reject) => {
    const tickerInfo = marketToSupported(market)

    if (tickerInfo === undefined) {
      reject(new Error('Invalid market.'))
      return
    }

    const ticker = tickerInfo[0]
    const inverted = tickerInfo[1]

    const url = 'https://api.bitfinex.com/v2/book/t' + ticker.toUpperCase() + '/P0/?len=100'

    request(url, (error, response, body) => {
      if (error) {
        reject(error)
        return
      }
      const responseObj = JSON.parse(response.toJSON().body)

      if (responseObj[0] == 'error') {
        reject(responseObj[2])
        return
      }

      const buyOrders = lo.filter(responseObj, (order) => {
        return Number(order[2]) < 0
      })

      const sellOrders = lo.filter(responseObj, (order) => {
        return Number(order[2]) > 0
      })

      if (buyOrders.length == 0 || sellOrders.length == 0) reject('No data received.')

      resolve({
        'BUY': lo.map(buyOrders, (order) => {
          return {
            'RATE':     Decimal(order[0]),
            'QUANTITY': Decimal(order[1])
          }
        }),
        'SELL': lo.map(sellOrders, (order) => {
          return {
            'RATE':     Decimal(order[0]),
            'QUANTITY': Decimal(order[1])
          }
        })
      })
    })
  })
}

module.exports.getOrderBook = getOrderBook
