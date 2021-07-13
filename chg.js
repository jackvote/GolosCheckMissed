// --------- Настройки программы -----------------

// необходимые библиотеки устанавливаются через npm
const golos = require("golos-classic-js")
const request = require("request")
//const GOLOSNODE = "wss://golos.lexai.host/ws" // public node
const GOLOSNODE = "ws://192.168.1.210:8091" // local node
golos.config.set('websocket', GOLOSNODE)

// --------- Настройки скрипта -----------------

var wif="5Qwerty..." // active key
var owner="jackvote"
var urlon="https://golos.id/ru--delegat/@jackvote/jackvote---v-delegaty" // URL заявления о намерениях
var urloff="Disabled via serv-js"                                       // сообщение об автоматическом отключении делегата
var keyoff="GLS1111111111111111111111111111111114T1Anm"
var keyon="GLS7PGuVBUCVcRmm9eFrYQu99oPHxGTV18BbJszNDsGs5v8vANx8k" // public key
var missed=0 // для теста установить меньше реально пропущенных блоков, 0 - для нормального запуска
var disable=false // если нода в отключке и надо сразу запустить - поставить true или запустится через:
var timeout=28 // 28 sec период проверки работоспособности (чтобы не дёргать часто ноду)
var timedef=10*60 // 10 min время ожидания восстановления работоспособности
var timeclear = 12*60*60 // 12 hour период сброса timewait в начальное значение
var setfeed=true // устанавливать ли прайсфид

var timewait=timedef

console.log("Start")

function checkMissed() { // проверка пропущенных блоков
  try {
    golos.api.getWitnessByAccount(owner,function(err,result){
        if (err) {
            console.log(err)
            return
        }
        if (result.signing_key==keyoff) { // отключена ли нода
            disable=true
        } else {
            disable=false
        }
// получем данные ранее установленные для делегата
        let props={ account_creation_fee: result.props.account_creation_fee,
                    maximum_block_size: result.props.maximum_block_size,
                    sbd_interest_rate: result.props.sbd_interest_rate
                }
        if (missed==0) { // начальная инициализация счётчика при запуске скрипта
            missed=result.total_missed
            console.log(Date(), "Set current:", missed) // запоминаем начальное значение
            return
        }
        if (result.total_missed>missed && disable!=true) { // если счётчик увеличился, а нода не отключена
            missed=result.total_missed
            setkey(false, props) // отключаем
            timewait=timewait*2
            return
        }
        if (result.total_missed>missed && disable) { // если счётчик увеличился, а нода отключена
            missed=result.total_missed
            console.log(Date(), "Disable now:", missed) // игнорируем
            return
        }
        if (missed==result.total_missed && disable) { // счётчик не изменился - включаем
            setkey(true, props) // включаем
            return
        }
    });
  } catch (e) {
    console.log(">>>", e.message)
  }
}

function setkey(action, props) { // установка ключа активации/деактивации
  try {
    let key=keyoff
    let url=urloff
    if (action) {
        key=keyon
        url=urlon
        func="Enable"
    } else {
        func="Disable"
    }
//    console.log(action, key)
    golos.broadcast.witnessUpdate(wif,owner,url,key,props,"0.000 GOLOS",function(err,result){
        if (err) {
            console.log(err)
            return
        }
//      console.log(result)
        console.log(Date(), func, owner,":", missed)
    });
//console.log("setkey:", key)
  } catch (err) {
    console.log("SetKey >>>", e.name)
  }
}

// функции для установки price-feed
function getUrl() {
    if (!setfeed) {
        return
    }
    request("https://expertgroup.org/get_feed.php", async function (err, res) {
//    console.log(res.body)
        try {
            let obj=JSON.parse(res.body)
            console.log(obj)
            let exchange_rate=JSON.parse('{"base":"'+obj.FEED.toFixed(3)+' GBG","quote":"1.000 GOLOS"}')
            console.log("Ok")
            feed(exchange_rate)
        } catch(e) {
            console.log("GetUrl >>>", e.message);
//      process.exit(0);
            return
        }
    })
}

function feed(base) {
  try {
        golos.broadcast.feedPublish(wif,owner,base,function(err,result){
            if (err) {
                console.log(owner, "Проблемы", base)
            }
            if (result) {
                console.log(owner, "Опубликовали", base)
            }
        })
  } catch (err) {
    console.log("SetFeed >>>", e.name)
  }
}

/// Основной цикл
const startCheck = () => {

    timerCheckOff = setInterval(()=>{
        if (!disable) {
            checkMissed()
        }
    }, timeout*1000) // ~30 sec

    timerCheckOn = setInterval(()=>{
        if (disable) {
            checkMissed()
        }
    }, timewait*1000) // ~10 min

    timerCheckOn = setInterval(()=>{
        getUrl() // установка прайсфид раз в сутки
    }, 24*60*60*1000)

    timerClear = setInterval(()=>{
        timewait=timedef
    }, timeclear*1000)
}

const startBot = () => {
    checkMissed() // получаем первоначальные значения пропущенных блоков
    getUrl()      // устанавливаем прайсфид
    startCheck()  // запускаем периодическую проверку
}

startBot() // запуск скрипта
