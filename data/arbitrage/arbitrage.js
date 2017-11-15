const utils = require('../utils')
const Decimal = require('decimal.js')
const _ = require('lodash')

class Arbitrage {
  /**
  * @param {Array} markets
  * @param {Array} buyOrSells
  * @param {Array} orderBooks
  * @param {MulticurrencyAccount} availableFundsAccount
  * @param {String} profitCurrency
  */
  constructor(markets, buyOrSells, orderbooks, availableFundsAccount, profitCurrency) {
    this.markets = markets
    this.buyOrSells = buyOrSells
    this.orderbooks = orderbooks
    this.availableFundsAccount = availableFundsAccount
    this.profitCurrency = profitCurrency

    if (markets.length === 0) throw new Error('Incorrect markets dimensions')
    if (!(markets.length === buyOrSells.length && buyOrSells.length === orderbooks.length)) throw new Error('Improper dimensions for markets, buyOrSells or orderbooks.')
    if (!availableFundsAccount || availableFundsAccount.isEmpty()) throw new Error('Account of available funds should be not empty.')
  }

  getDeals() {
    let incorrectArbitrage = false

    let shouldOptimizeVolumes = true
    // let multiplicators = _.map(Array(this.markets.length), () => { return Decimal(1.0) })
    let multiplicator = Decimal(1.0)

    var arbitrageAccount
    var deals
    var k  = 0

    while (shouldOptimizeVolumes) {
      arbitrageAccount = this.availableFundsAccount.copy()
      deals = []

      for (var j = 0; j < this.markets.length; j++) {
        let direction = this.buyOrSells[j]
        let orderBookColumn = this.directionToOrder(direction) // inversed buy or sell, because we need counteroffer
        let market = this.markets[j]

        // volume available at exchange, we use [0], since we want TOP of the order book
        let availableVolume = this.orderbooks[j][orderBookColumn][0][utils.const.VOLUME]  // decimal containing the quantity of currency pairs for the deal available on exchange
        let availablePrice =  this.orderbooks[j][orderBookColumn][0][utils.const.PRICE]   // decimal containing price for the deal available on exchange

        let whatCurrencyIspend = this.whatCurrencyISpend(market.buyOrSell(direction, availablePrice, availableVolume))
        let fundsIhaveForSpend = arbitrageAccount.getBalance()[whatCurrencyIspend] || Decimal(0)

        var requiredVolume;
        if (whatCurrencyIspend === market.marketCurrency) {
          requiredVolume = fundsIhaveForSpend  // I must spend everything I have
        } else if (whatCurrencyIspend === market.secondCurrency) {
          requiredVolume = fundsIhaveForSpend.dividedBy(availablePrice) // I must spend everything I have
        } else {
          throw new Error(`I spend strange currency ${whatCurrencyIspend}`)
        }

        if (j == 0) {
          requiredVolume = multiplicator.mul(requiredVolume)
        }

        if (requiredVolume.lessThan('0.00000001')) {
          incorrectArbitrage = true
          shouldOptimizeVolumes = false
          console.log('incorrect');
          break
        }

        if (requiredVolume.greaterThan(availableVolume)) {
          multiplicator = multiplicator.mul(availableVolume.dividedBy(requiredVolume))
          shouldOptimizeVolumes = true
          break
        }

        let diff = market.buyOrSell(direction, availablePrice, requiredVolume)
        let whatISpend = this.whatCurrencyISpend(diff)

        // then I store the new deal into `deals` buffer of this arbitrage
        deals.push([market.name, direction, requiredVolume, availablePrice])
        // and update arbitrage balance as well
        arbitrageAccount.updateBalance(diff)
        shouldOptimizeVolumes = false
      }
    }
    if (incorrectArbitrage) return null

    let profit = Decimal(arbitrageAccount.getBalance()[this.profitCurrency]).sub(Decimal(this.availableFundsAccount.getBalance()[this.profitCurrency]))
    return [deals, arbitrageAccount, profit]
  }

  whatCurrencyISpend(diff) {
    for (var k in diff) {
      if (Decimal(diff[k]).isNegative()) return k
    }
    throw new Error('Provided diff that have no spendings. May be it is malformed deal?')
  }

  whatCurrencyIGet(diff) {
    for (var k in diff) {
      if (diff[k].isPositive()) return k
    }
    throw new Error('Provided diff that have no incomes. May be it is malformed deal?')
  }


  directionToOrder(d) {
    if (d === utils.const.BUY) return utils.const.ASK // you can `buy` from ASK
    if (d === utils.const.SELL) return utils.const.BID // you can `sell` to BID
    throw new Error('Direction of the deal should be either BUY or SELL and will respond with corresponding side of OrderBook')
  }

}

module.exports = Arbitrage