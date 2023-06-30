const ROOT_URL = "https://horowest-ideal-space-spork-7v95v7wwjpq2pqv-8080.preview.app.github.dev";


const connectionObject = {
    conn: new RTCPeerConnection(),
    userId: crypto.randomUUID()
}

const intervals = {

}

let connect_button = document.getElementById("connect-btn");
connect_button.onclick = e => handleConnection(connectionObject);

let disconnect_btn = document.getElementById("disconnect-btn");
disconnect_btn.onclick = e => connectionObject.conn.close();

console.log("User ID: " + connectionObject.userId);

connectionObject.conn.onicecandidate = e => { 
    const SDP_JSON = JSON.stringify(connectionObject.conn.localDescription);
    document.getElementById("sdp").value = SDP_JSON;
    // console.log(SDP_JSON);

};

// create channel
connectionObject.channel = connectionObject.conn.createDataChannel("channel");

// create event listerners for channel
connectionObject.channel.onopen = e => connectionOpened();
connectionObject.channel.onclose = e => connectionClosed();

connectionObject.channel.onmessage = e => {
    document.getElementById("reply").innerHTML = e.data;
};


// create offer and set as local description
const offer = connectionObject.conn.createOffer();
connectionObject.conn.setLocalDescription(offer);

// buttons and evenet listners
// const offer_button = document.getElementById("offer-btn");
// offer_button.addEventListener('click', e => createOffer(connectionObject));

// const answer_button = document.getElementById("answer-btn");
// answer_button.addEventListener('click', e => createAnswer(connectionObject, null))

const send_button = document.getElementById("send-btn");
send_button.addEventListener('click', e => messageHandler(connectionObject))


function createOffer(connectionObject, response) {
    let answer = JSON.parse(document.getElementById("sdp").value);

    if(response != null) {
        answer = response.sdpKey;
    }
        
    try {
        connectionObject.conn.setRemoteDescription(answer);
    } catch(e) {
        console.log(e);
    }   
}


async function createAnswer(connectionObject, response) {
    connectionObject.conn.ondatachannel = e => {
        let channel = e.channel;
        
        // create event listerners for channel
        // channel.onopen = e => connectionOpened();
        // channel.onclose = e => connectionClosed();
        channel.onmessage = e => {
            document.getElementById("reply").innerHTML = e.data;
        };

        connectionObject.channel = channel;
    };

    let offer = JSON.parse(document.getElementById("sdp").value);

    if(response != null) {
        offer = response.sdpKey;
    }

    connectionObject.conn.setRemoteDescription(offer);
    let answer = await connectionObject.conn.createAnswer();
    connectionObject.conn.setLocalDescription(answer);

    return answer;
}


function messageHandler(connectionObject) {
    const msg = document.getElementById("msg").value;
    connectionObject.channel.send(msg);
}


function connectionOpened() {
    console.log("Connected");
    document.getElementById("conn-msg").innerHTML = "Connected";
    document.getElementById("sdp").value = "";
    
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

async function handleConnection(connectionObject) {
    const offerKey = connectionObject.conn.localDescription;

    let payload = {
        userId: connectionObject.userId,
        sdpKey: {
            sdp: offerKey.sdp,
            type: offerKey.type
        }
    };

    let res = await apiCall("/api/connect", "POST", payload);


    if(res.ok && res.status === 200) {
        let data = await res.json();
        // console.log(data);

        // create answer for offer and send it to server
        const answer = await createAnswer(connectionObject, data);
        res = apiCall("/api/answer", "POST", {
            userId: data.userId, 
            sdpKey: {
                sdp: answer.sdp,
                type: answer.type
            }
        });
        document.getElementById("conn-msg").innerHTML = "Waiting to connect";
	    res.then(res => res.text()).then(data => console.log(data));

    } else if(res.status === 204) {
        // wait for offer to be answered
        // then use the answer to set remote desciption
        console.log("Waiting for offer to be answered");
        document.getElementById("conn-msg").innerHTML = "Waiting for offer to be answered";
        // check for offer
        intervals.offer = setInterval(() => checkForOffer(connectionObject), 10000);
    }

}

/*
 *  polling for connection
 */
async function checkForOffer(connectionObject) {
    let res = await apiCall("/api/offer", "POST", {userId: connectionObject.userId});

    if(res.status == 200) {
        clearInterval(intervals.offer);
        const data = await res.json();
        createOffer(connectionObject, data);
        // return await res.json();
    }
}

async function apiCall(url, method, payload) {
    const connectURL = ROOT_URL + url;
    
    let res = await fetch(connectURL, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return res;
}
