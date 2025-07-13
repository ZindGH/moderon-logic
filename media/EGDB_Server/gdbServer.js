
const vscode = acquireVsCodeApi();

const updatePortListBtn = document.getElementById("updatePortList-js");
const flushBtn = document.getElementById("flushBtn-js");
const portId = document.getElementById("portId-js");
const baudRateId = document.getElementById("baudRateId-js");
const parityId = document.getElementById("parityId-js");
const stopBitsId = document.getElementById("stopBitsId-js");

const serverPortId = document.getElementById("serverPortId-js");
const baudRateGdbId = document.getElementById("baudRateGdbId-js");
const parityGdbId = document.getElementById("parityGdbId-js");
const stopBitsGdbId = document.getElementById("stopBitsGdbId-js");



function flushBtnHandler() {

	vscode.postMessage({
		command: 'attach',
		data: {
			'portId': portId.value, 'baudRateId': baudRateId.value, 'parityId': parityId.value, 'stopBitsId': stopBitsId.value,
			'serverPortId': serverPortId.value, 'baudRateGdbId': baudRateGdbId.value, 'parityGdbId': parityGdbId.value, 'stopBitsGdbId': stopBitsGdbId.value 
		}
	});

}


function updatePortListBtnHandler() {
	vscode.postMessage({
		command: 'updatePortList'
	});

}

flushBtn.addEventListener("click", flushBtnHandler);
updatePortListBtn.addEventListener("click", updatePortListBtnHandler);


window.addEventListener('message', event => {

	const message = event.data; // The JSON data our extension sent

	switch (message.command) {
		case 'refactor':
			aJs.innerHTML = "-__-";
			break;
		case 'setPortList':
			{
				let newData = "<option disabled>Select port name</option>\n";
				for (let port of message.data.ports) {
					newData += `<option value="${port}">${port}</option>\n`;
				}
				portId.innerHTML = newData;
				break;
			}
		case 'setPortParams':
			{
				let newData = "<option disabled>Select port name</option>\n";
				for (let port of message.data.ports) {
					newData += `<option value="${port}">${port}</option>\n`;
				}
				portId.innerHTML = newData;
				portId.value = message.data.portId;

				baudRateId.value = message.data.baudRateId;
				parityId.value = message.data.parityId;
				stopBitsId.value = message.data.stopBitsId;

				serverPortId.value = message.data.serverPortId;
				baudRateGdbId.value = message.data.baudRateGdbId;
				parityGdbId.value = message.data.parityGdbId;
				stopBitsGdbId.value = message.data.stopBitsGdbId;

				break;
			}
	}
});