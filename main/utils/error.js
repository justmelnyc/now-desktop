// Packages
const { shell, app, dialog } = require('electron')
const isDev = require('electron-is-dev')
const bytes = require('bytes')

// Utilities
const { getConfig } = require('./config')

exports.exception = async () => {
  // Restart the app, so that it doesn't continue
  // running in a broken state
  if (!isDev) {
    app.relaunch()
  }

  app.exit(0)
}

const renderError = async trace => {
  const { code } = trace

  if (code === 'size_limit_exceeded') {
    const limit = bytes(trace.sizeLimit, { unitSeparator: ' ' })
    const fileSize =
      trace.file && bytes(trace.file.size, { unitSeparator: ' ' })

    let buttons = []

    try {
      const config = await getConfig()
      let url = 'https://zeit.co/account/plan'

      if (config.currentTeam) {
        const { slug } = config.currentTeam
        url = `https://zeit.co/teams/${slug}/settings/plan`
      }

      buttons.push({
        label: 'Ignore'
      })

      buttons = [
        {
          label: 'Upgrade',
          url
        },
        {
          label: 'Cancel'
        }
      ]
    } catch (err) {}

    const hasMultiple = trace.file.length > 0
    const suffix = hasMultiple ? ':' : '.'

    return {
      message: 'File Size Limit Exceeded',
      detail:
        `You tried to upload files whose size${
          fileSize ? ` (${fileSize})` : ''
        } is bigger than your plan's file size limit (${limit})${suffix}\n\n` +
        (hasMultiple ? `${trace.file.names.join('\n')}\n\n` : '') +
        `In order to be able to upload it, you need to switch to a higher plan.`,
      buttons,
      defaultId: 0
    }
  }

  if (code === 'cannot_parse_response') {
    return {
      message: trace.message,
      detail:
        "Now Desktop wasn't able to parse the response from our servers. Please try again."
    }
  }

  return {}
}

exports.error = async (detail, trace, win) => {
  const message = {
    type: 'error',
    message: 'An Error Occurred',
    detail,
    buttons: []
  }

  let modified = null

  if (trace) {
    console.error(trace)

    if (trace.code) {
      modified = await renderError(trace)
    }
  }

  if (modified) {
    Object.assign(
      message,
      modified,
      modified.buttons
        ? {
            buttons: modified.buttons.map(button => button.label)
          }
        : {}
    )
  }

  const answer = dialog.showMessageBox(win || null, message)
  let target = {}

  if (modified && modified.buttons && modified.buttons.length > 0) {
    target = modified.buttons.find(button => {
      return button.label === message.buttons[answer]
    })
  }

  if (target.url) {
    shell.openExternal(target.url)
  }
}
