const ROOT_URL = "http://localhost:8080/api/v1";
const CONNECTION = {
    rc: new RTCPeerConnection(),
    userId: crypto.randomUUID()
}

const connect_button = document.getElementById("connect-btn");
const disconnect_btn = document.getElementById("disconnect-btn");
const send_button = document.getElementById("send-btn");

const messageStack = [];

const intervals = {
}

setup();

function setup() {
    console.log("User ID: " + CONNECTION.userId);
    
    // declare event listerners
    connect_button.onclick = e => handleConnection(CONNECTION);
    disconnect_btn.onclick = e => CONNECTION.rc.close();
    send_button.onclick = e => messageHandler(CONNECTION);
    
    CONNECTION.rc.onicecandidate = e => { 
        const SDP_JSON = JSON.stringify(CONNECTION.rc.localDescription);
        console.log(SDP_JSON);

        // document.getElementById("sdp").value = SDP_JSON;
    };
    
    // create channel
    CONNECTION.channel = CONNECTION.rc.createDataChannel("channel");
    
    // create event listerners for channel
    CONNECTION.channel.onopen = e => connectionOpened();
    CONNECTION.channel.onclose = e => connectionClosed();
    CONNECTION.channel.onmessage = e => messageReciever(e);
    
    // create offer and set as local description
    const offer = CONNECTION.rc.createOffer();
    CONNECTION.rc.setLocalDescription(offer);
}

function createOffer(CONNECTION, response) {
    // let answer = JSON.parse(document.getElementById("sdp").value);    
    if(response != null) {
        try {
            CONNECTION.rc.setRemoteDescription(response.iceCandidate);
        } catch(e) {
            console.log(e);
        }   
    }
        
}

async function createAnswer(CONNECTION, response) {
    CONNECTION.rc.ondatachannel = e => {
        let channel = e.channel;
        
        // create event listerners for channel
        // channel.onopen = e => connectionOpened();
        // channel.onclose = e => connectionClosed();
        channel.onmessage = e => messageReciever(e);

        CONNECTION.channel = channel;
    };

    if(response != null) {
        let offer = response.iceCandidate;
        CONNECTION.rc.setRemoteDescription(offer);
        let answer = await CONNECTION.rc.createAnswer();
        CONNECTION.rc.setLocalDescription(answer);
    
        return answer;
    }

}

function messageHandler(CONNECTION) {
    const msg = document.getElementById("msg").value;
    CONNECTION.channel.send(msg);
}

function messageReciever(msgEvent, callback = null) {
    document.getElementById("reply").innerHTML += "<br/>" + msgEvent.data;

    if(callback != null) {
        callback(msgEvent);
    }
}


function connectionOpened() {
    console.log("Connected");
    document.getElementById("conn-msg").innerHTML = "Connected";
    
    // enable elements
    document.getElementById("connect-btn").disabled = true;
    document.getElementById("disconnect-btn").disabled = false;

    let msgBoxElements = document.getElementsByClassName("msg-box");
    for(let eachElement of msgBoxElements) {
        eachElement.disabled = false;
    }
}

function connectionClosed() {
    console.log("Closed");
    document.getElementById("conn-msg").innerHTML = "Disconnected";
    document.getElementById("sdp").value = "";
    
    // disable elements
    document.getElementById("connect-btn").disabled = false;
    document.getElementById("disconnect-btn").disabled = true;

    let msgBoxElements = document.getElementsByClassName("msg-box");
    for(let eachElement of msgBoxElements) {
        eachElement.disabled = true;
    }

}

async function handleConnection(CONNECTION) {
    const offerKey = CONNECTION.rc.localDescription;
    const username = document.getElementById("username").value;
    const otherusername = document.getElementById("otherusername").value;
    CONNECTION.username = username;
    CONNECTION.otherusername = otherusername;

    let payload = {
        username: CONNECTION.username,
        otherUsername: CONNECTION.otherusername,
        iceCandidate: {
            type: offerKey.type,
            sdp: offerKey.sdp
        }
    };

    let res = await apiCall("/exchange", "POST", payload);


    if(res.status === 202) {
        let data = await res.json();
        // console.log(data);

        // create answer for offer and send it to server
        const answer = await createAnswer(CONNECTION, data);
        res = apiCall("/exchange", "POST", {
            username: data.username,
            otherUsername: CONNECTION.username,
            iceCandidate: {
                type: answer.type,
                sdp: answer.sdp
            }
        });
        document.getElementById("conn-msg").innerHTML = "Waiting to connect";
	    res.then(res => res.text()).then(data => console.log(data));

    } else if(res.status === 201) {
        // wait for offer to be answered
        // then use the answer to set remote desciption
        console.log("Waiting for offer to be answered");
        document.getElementById("conn-msg").innerHTML = "Waiting for offer to be answered";
        // check for offer
        intervals.offer = setInterval(() => checkForOffer(CONNECTION), 5000);
    }

}

/*
 *  polling for connection
 */
async function checkForOffer(CONNECTION) {
    let res = await apiCall("/connect?" + new URLSearchParams({
        username: CONNECTION.username,
        otherUsername: CONNECTION.otherusername
    }), "GET");

    if(res.status == 200) {
        clearInterval(intervals.offer);
        const data = await res.json();
        createOffer(CONNECTION, data);
        // return await res.json();
    }
}

async function apiCall(url, method, payload) {
    const connectURL = ROOT_URL + url;
    
    if(method === "GET") {
        return await fetch(connectURL);
    }
    
    let res = await fetch(connectURL, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return res;
}
