describe('Progress Persistence', () => {
  const gameId = Cypress.env('gameId') ?? 'local/GameSkeleton'
  const gameUrl = `/#/g/${gameId}`

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
    cy.window({ timeout: 60000 }).should((win) => {
      const getCode = (win as any).__lean4game_getCode as (() => string) | undefined
      expect(getCode, 'getCode hook').to.be.a('function')
      const code = getCode ? getCode() : ''
      expect(code, 'saved code').to.include('rw [h]')
      expect(code, 'saved code').to.include('rw [g]')
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
})
