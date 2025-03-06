# Demo for a Blockchain powered car insurance

This is a simple demonstration of how blockchain can easily be used to create a dynamic usage based car insurance
that rewards motorists for having good driving practices

This is a simple POC-based implementation that uses a 3d car  that connects to an AI that does a risk score of the drivers driving based off
vehicular telematics data from the simulated engine variables 

use arrow keys to navigate 

         foward
           ^
           |  
    left <-   -> right
            |
            reverse
          


and  **space bar**  to stop


## How to run

Run

```console 
git clone https://github.com/DennisMuasyaWambua/car_blockchaininsurance_nextjs_animation/
```

```console
npm install
```

```console
npm run dev
```

## How it works

Upon running the software the insurer connects their **metamask wallet** and after connecting their metamask wallet they add a driver into their insurance plan 
Afer adding the driver the insurer adds the value of the price of the car in etherum and then registers the driver. After the driver is registered the smart contract calculates the drivers base insurance premium for the driver to pay.
This base insurance premium is the cheapest that a driver can pay if they maintain good driving behaviour and obey traffic laws as judged by the the on-board ai model's risk score that will be fitted in the drivers car **OBDII interface**.
If the driver drives recklessley and they get a higher risk score their premium for that month will be higher.

The smart contract is deployed on the Lisk blockchain which is a layer 2 chain.


## Technologies used
- [x] Solidity
- [x] Nextjs  
- [x] Three js
- [x] Xgboost (Machine learning model used)
- [x] Django restframework
- [x] Thirdweb



