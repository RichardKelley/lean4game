describe('Progress Persistence', () => {
  const gameId = Cypress.env('gameId') ?? 'local/GameSkeleton'
  const gamePath = gameId.startsWith('g/') ? gameId.slice(2) : gameId
  const gameKey = `g/${gamePath}`.toLowerCase()
  const gameUrl = `/#/g/${gamePath}`

  const ignoreLeanErrors = () => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('Stopping the server timed out') ||
          err.message.includes('timeout') ||
          err.message.includes('WebSocket') ||
          err.message.includes('Socket') ||
          err.message.includes('Connection')) {
        return false
      }
      return true
    })
  }

  const visitGame = () => {
    cy.visit(gameUrl, {
      onBeforeLoad(win) {
        win.localStorage.clear()
      },
    })
  }

  const navigateToFirstLevel = () => {
    cy.get('.level-title', { timeout: 60000 }).first().click({ force: true })
    cy.url().should('include', '/level/0')
    cy.contains('Start', { timeout: 60000 }).click()
    cy.url().should('include', '/level/1')
    cy.get('.typewriter-input .monaco-editor', { timeout: 30000 }).should('be.visible')
  }

  const ensureEditorMode = () => {
    cy.get('body').then($body => {
      if ($body.find('.fa-code').length) {
        cy.get('.fa-code').click()
      }
    })
    cy.get('.codeview .monaco-editor', { timeout: 30000 }).should('be.visible')
  }

  const enterEditorSolution = () => {
    ensureEditorMode()
    cy.get('.codeview .monaco-editor textarea')
      .click({ force: true })
      .type('rw [h]{enter}rw [g]', { force: true })
  }

  const waitForTypewriterIdle = () => {
    cy.get('.typewriter button', { timeout: 30000 }).should('not.be.disabled')
  }

  const enterTypewriterSolution = () => {
    waitForTypewriterIdle()
    cy.get('.typewriter-input .monaco-editor .view-lines')
      .click({ force: true })
      .type('rw [h]{enter}')
    cy.get('.typewriter button').should('be.disabled')
    waitForTypewriterIdle()
    cy.get('.typewriter-input .monaco-editor .view-lines')
      .click({ force: true })
      .type('rw [g]{enter}')
    cy.get('.typewriter button').should('be.disabled')
    waitForTypewriterIdle()
  }

  const assertCompleted = () => {
    cy.contains('Level completed', { timeout: 30000 }).should('be.visible')
  }

  const waitForProgressSave = () => {
    cy.window({ timeout: 60000 }).should((win) => {
      const stored = win.localStorage.getItem('game_progress') ?? ''
      expect(stored, 'saved progress').to.include('rw [h]')
      expect(stored, 'saved progress').to.include('rw [g]')
    })
  }

  const assertSavedCode = () => {
    cy.location('hash').then((hash) => {
      const match = hash.match(/world\/([^/]+)\/level\/(\d+)/) || []
      const worldId = match[1]
      const levelId = match[2]

      cy.window({ timeout: 60000 }).should((win) => {
        const progress = JSON.parse(win.localStorage.getItem('game_progress') || '{}')
        const code =
          progress.games?.[gameKey]?.data?.[worldId]?.[levelId]?.code ?? ''
        expect(code, 'saved code').to.include('rw [h]')
        expect(code, 'saved code').to.include('rw [g]')
      })
    })
  }

  const returnHomeAndBack = () => {
    cy.get('#home-btn').click()
    cy.get('.level-title', { timeout: 30000 }).first().click({ force: true })
    cy.url().should('include', '/level/0')
    cy.contains('Start', { timeout: 30000 }).click()
    cy.url().should('include', '/level/1')
  }

  beforeEach(() => {
    ignoreLeanErrors()
    visitGame()
  })

  it('saves code field', () => {
    navigateToFirstLevel()
    enterEditorSolution()
    waitForProgressSave()

    cy.location('hash').then((hash) => {
      const match = hash.match(/world\/([^/]+)\/level\/(\d+)/) || []
      const worldId = match[1]
      const levelId = match[2]

      cy.window({ timeout: 60000 }).should((win) => {
        const progress = JSON.parse(win.localStorage.getItem('game_progress') || '{}')
        const code =
          progress.games?.[gameKey]?.data?.[worldId]?.[levelId]?.code ?? ''
        expect(code).to.include('rw [h]')
        expect(code).to.include('rw [g]')
      })
    })
  })

  it('persists editor mode code and completion', () => {
    navigateToFirstLevel()
    enterEditorSolution()
    assertCompleted()
    waitForProgressSave()
    returnHomeAndBack()
    assertSavedCode()
    assertCompleted()
  })

  it('persists typewriter mode code and completion', () => {
    navigateToFirstLevel()
    enterTypewriterSolution()
    assertCompleted()
    waitForProgressSave()
    returnHomeAndBack()
    assertSavedCode()
    assertCompleted()
  })

  it('does not reuse code for a level with no saved progress', function () {
    let emptyLevelId: number | null = null
    let currentWorldId = '0'
    navigateToFirstLevel()
    enterEditorSolution()
    assertCompleted()
    waitForProgressSave()

    cy.url().then((url) => {
      const match = url.match(/world\/([^/]+)\/level\/(\d+)/)
      currentWorldId = match?.[1] ?? '0'
    })

    cy.get('#home-btn').click()
    cy.get('.level:not(.disabled) .level-title', { timeout: 30000 }).then(($titles) => {
      const levels = [...$titles]
        .map((el) => Number.parseInt(el.textContent?.trim() ?? '', 10))
        .filter((value) => Number.isFinite(value))
      const candidate = levels.find((value) => value !== 1) ?? null
      if (!candidate) {
        cy.log('Skipping: only one playable level found; cannot test cross-level restore.')
        this.skip()
      }
      emptyLevelId = candidate
    })

    cy.window().then((win) => {
      const stored = win.localStorage.getItem('game_progress') ?? ''
      const progress = stored ? JSON.parse(stored) : { games: {} }
      if (progress.games?.[gameKey]?.data?.[currentWorldId] && emptyLevelId !== null) {
        delete progress.games[gameKey].data[currentWorldId][emptyLevelId]
      }
      win.localStorage.setItem('game_progress', JSON.stringify(progress))
    })

    cy.contains('.level-title', `${emptyLevelId}`, { timeout: 30000 })
      .click({ force: true })
    cy.url().should('include', `/level/${emptyLevelId}`)

    ensureEditorMode()
    cy.location('hash').then((hash) => {
      const match = hash.match(/world\/([^/]+)\/level\/(\d+)/) || []
      const worldId = match[1]
      const levelId = match[2]

      cy.window({ timeout: 60000 }).should((win) => {
        const progress = JSON.parse(win.localStorage.getItem('game_progress') || '{}')
        const code =
          progress.games?.[gameId.toLowerCase()]?.data?.[worldId]?.[levelId]?.code ?? ''
        expect(code, 'should not reuse prior level code').to.not.include('rw [h]')
        expect(code, 'should not reuse prior level code').to.not.include('rw [g]')
      })
    })
  })


})
