
const vscode = acquireVsCodeApi();

const updatePortListBtn = document.getElementById("updatePortList-js");
const flushBtn = document.getElementById("flushBtn-js");
// const aJs = document.getElementById("a-js");
const portId = document.getElementById("portId-js");
const isResetToDef = document.getElementById("isResetToDef-js");
const isForceErase = document.getElementById("isForceErase-js");
const baudRateId = document.getElementById("baudRateId-js");
const parityId = document.getElementById("parityId-js");
const stopBitsId = document.getElementById("stopBitsId-js");



function flushBtnHandler() {
	// 	aJs.textContent = "Dummy Text 2";
	// 	alert("Hello");
	//   console.log("Hello!");
	//   aJs.innerHTML="Dummy Text: "+portId.value;

	vscode.postMessage({
		command: 'flash',
		data: {
			'portId': portId.value, 'isResetToDef': isResetToDef.checked, 'isForceErase': isForceErase.checked,
			'baudRateId': baudRateId.value, 'parityId': parityId.value, 'stopBitsId': stopBitsId.value
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

				isResetToDef.checked = message.data.isResetToDef;
				isForceErase.checked = message.data.isForceErase;

				baudRateId.value = message.data.baudRateId;
				parityId.value = message.data.parityId;
				stopBitsId.value = message.data.stopBitsId;

				break;
			}
	}
});