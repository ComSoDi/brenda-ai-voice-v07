// public/i18n.js
// Minimal UI strings for English + Spanish with regional variants.

const STRINGS = {
  "en-US": {
    connect: "Talk",
    disconnect: "Disconnect",
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    speaking: "Speaking",
    hintTalk: "Connect and speak with pauses",
    hintText: "Connect and chat via text",
    placeholder: "Conversation will appear here...",
    youLabel: "You",
    assistantLabel: "Brenda",
    send: "Send",
    textInputPlaceholder: "Type a message..."

  },
  "en-GB": {
    connect: "Talk",
    disconnect: "Disconnect",
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    speaking: "Speaking",
    hintTalk: "Connect and speak with pauses",
    hintText: "Connect and chat via text",
    placeholder: "Conversation will appear here...",
    youLabel: "You",
    assistantLabel: "Brenda",
    send: "Send",
    textInputPlaceholder: "Type a message..."
  },
  "es-ES": {
    connect: "Habla",
    disconnect: "Desconectar",
    disconnected: "Desconectada",
    connecting: "Conectando",
    connected: "Conectada",
    speaking: "Hablando",
    hintTalk: "Conecta y habla con pausas",
    hintText: "Conecta y chatea via texto",
    placeholder: "La conversación aparecerá aquí...",
    youLabel: "Tú",
    assistantLabel: "Brenda",
    send: "Enviar",
    textInputPlaceholder: "Escribe un mensaje..."
  },
  "es-419": {
    connect: "Habla",
    disconnect: "Desconectar",
    disconnected: "Desconectada",
    connecting: "Conectando",
    connected: "Conectada",
    speaking: "Hablando",
    hintTalk: "Conecta y habla con pausas",
    hintText: "Conecta y chatea via texto",
    placeholder: "La conversación aparecerá aquí...",
    youLabel: "Tú",
    assistantLabel: "Brenda",
    send: "Enviar",
    textInputPlaceholder: "Escribe un mensaje..."
  }
};

export function t(localeVariant, key) {
  return (STRINGS[localeVariant] && STRINGS[localeVariant][key]) ||
         (STRINGS["en-US"][key]) ||
         key;
}
