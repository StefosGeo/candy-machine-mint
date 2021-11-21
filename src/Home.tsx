import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";
import { pink } from "@material-ui/core/colors";
import zombie from "./zombie.png";

const ConnectButton = styled(WalletDialogButton)``;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)``; // add your styles here

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main
      style={{
        // backgroundColor: "pink",
        display: "flex",
        height: "100vh"
      }}
    >
      <div
        style={{
          padding: 30,
          display: "flex",
          flex: 1,
          flexDirection: "column",
          // backgroundColor: "orange",
        }}>
        <div
          style={{
            // backgroundColor: "green",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {wallet && (
            <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || "")}</p>
          )}
          <div></div>
          <ConnectButton>{wallet ? "Connected" : "Connect Wallet"}</ConnectButton>
        </div>
        <div
          style={{
            // backgroundColor: "red",
            alignItems: "center",
            display: "flex",
            justifyContent: "center"
          }}>
          <h2>Mutant Zombies</h2>
        </div>
        <div style={{
          display: "flex",
          justifyContent: "center"
        }}>

          <img src={zombie} style={{ width: 300 }} />
        </div>
        <div
          style={{
            // backgroundColor: "blue",
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column"
          }}
        >
          <div>
            <MintContainer>

              <MintButton
                disabled={isSoldOut || isMinting || !isActive}
                onClick={onMint}
                variant="contained"
              >
                {isSoldOut ? (
                  "SOLD OUT"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    "MINT"
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
            </MintContainer>
          </div>
          <div>
            {wallet && <p>Supply: {itemsRedeemed}/{itemsAvailable}</p>}
          </div>
        </div>
        <div style={{
          // backgroundColor: "grey",
          justifyContent: "center",
          display: "flex",
          alignItems: "center",
          flexDirection: "column"
        }}>
          <h3>Roadmap</h3>
          <div className="timeline">
            <div className="timeline__component">
              <div className="timeline__date timeline__date--right">December 20 2021 12:0:0 EST</div>
            </div>
            <div className="timeline__middle">
              <div className="timeline__point"></div>
            </div>
            <div className="timeline__component timeline__component--bg">
              <h2 className="timeline__title"> Private Pre-Sale</h2>
              <p className="timeline__paragraph">
                Private pre-sale. Minting will be availabe through a private link at the price of 0.15 SOL and only 3 NFTs per wallet
              </p>
            </div>
            <div className="timeline__component timeline__component--bg">
              <h2 className="timeline__title">Public Sale</h2>
              <p className="timeline__paragraph">

              </p>
              <p className="timeline__paragraph">
                Public sale will take place in this site. Price 0.3 SOL per NFT, supply 3 Zombies per wallet.
              </p>
            </div>
            <div className="timeline__middle">
              <div className="timeline__point"></div>
            </div>
            <div className="timeline__component">
              <div className="timeline__date">December 22 2021 12:0:0 EST</div>
            </div>
            <div className="timeline__component">
              <div className="timeline__date timeline__date--right"></div>
            </div>
            <div className="timeline__middle">
              <div className="timeline__point"></div>
            </div>
            <div className="timeline__component timeline__component--bg">
              <h2 className="timeline__title">Marketplace listing</h2>
              <p className="timeline__paragraph">
                Few days afte public sale takes place, the collection will be listed on a NFT Marketplace
              </p>
            </div>
            <div className="timeline__component timeline__component--bottom timeline__component--bg">
              <h2 className="timeline__title">Token creation</h2>
              <p className="timeline__paragraph">
              </p>
              <p className="timeline__paragraph">
                A token will be created and Mutant Zombie hodlers will be  awarded.
              </p>
            </div>
            <div className="timeline__middle">
              <div className="timeline__point"></div>
              <div className="timeline__point timeline__point--bottom"></div>
            </div>
            <div className="timeline__component timeline__component--bottom">
              <div className="timeline__date"></div>
            </div>
          </div>
        </div>
        <div style={{
          // backgroundColor: "purple",
          justifyContent: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"

        }}>
          <h3>Team</h3>
          <div style={{ justifyContent: "center", display: "flex", flexDirection: "row", alignItems: "center"}}>
            <div style={{
              // backgroundColor: "purple",
              justifyContent: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding:10
              
            }}>
              <img src={zombie} style={{ width: 200 }} />
              <h4>Zpmbie Master </h4>
            </div>
            <div style={{
              // backgroundColor: "purple",
              justifyContent: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding:10

            }}>
              <img src={zombie} style={{ width: 200 }} />
              <h4>Zpmbie Creator (Artist)</h4>
            </div>
          </div>
        </div>
        <div style={{
          // backgroundColor: "grey",
          justifyContent: "center",
          display: "flex",
        }}>
          <h3>FAQ</h3>
        </div>
        <Snackbar
          open={alertState.open}
          autoHideDuration={6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </div>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
