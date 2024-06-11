
const vscode = acquireVsCodeApi();

const flushBtn = document.getElementById("flushBtn-js");
const aJs = document.getElementById("a-js");
const portId = document.getElementById("portId-js");
const isResetToDef = document.getElementById("isResetToDef-js");
const baudRateId = document.getElementById("baudRateId-js");



function flushBtnHandler() {
// 	aJs.textContent = "Dummy Text 2";
// 	alert("Hello");
//   console.log("Hello!");
  aJs.innerHTML="Dummy Text 435";

  vscode.postMessage({
	command: 'alert',
	text: '🐛  on line ',
	form: {'isResetToDef': isResetToDef.checked, 'baudRate' : baudRateId.value}
});
  
}

flushBtn.addEventListener("click", flushBtnHandler);


window.addEventListener('message', event => {

	const message = event.data; // The JSON data our extension sent

	switch (message.command) {
		case 'refactor':
			aJs.innerHTML="-__-";
			break;
		case 'setPortList':
			let newData = "<option disabled>Select port name</option>\n";
			for (let port of message.data.ports)
			{
				newData += `<option value="${port}">${port}</option>\n`;
			}
			portId.innerHTML=newData;
			break;
	}
});