const fs = require('fs')

let GeneralHelper = {
  randomNumber: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  currentTimestamp: () => {
    return Math.floor(Date.now() / 1000)
  },
  sleep: async (time) => new Promise((resolve) => setTimeout(resolve, time)),
  now: () => {
    return Math.floor(Date.now() / 1000)
  },

  hexToDecimal: (hex) => parseInt(hex, 16),

  createFile: (name) => {
    fs.appendFile(name, '', function (err) {
      if (err) throw err
      console.log(`Created file ${name}`)
    })
  },
  readFile: async (name) => {
    fs.readFile(name, (err, data) => {
      if (err) throw err
      return JSON.parse(data)
    })
  },
  writeFileSync: (name, data) => {
    fs.writeFileSync(name, data)
  },
  writeFile: async (name, data) => {
    // let oldData = fs.readFile(name)
    let _oldData = await GeneralHelper.readFile(name)
    // console.log('oldData', oldData)
    console.log('_oldData', _oldData)
    // let newData = _oldData.push(data)
    // //
    // fs.appendFile(name, JSON.stringify(newData), (err) => {
    //   if (err) throw err
    //   console.log(`Done. Data saved to ${name}`)
    //   console.log('Data', newData)
    // })
  },
}

module.exports = GeneralHelper
