module.exports =
    config:
        perlcriticExecutablePath:
            default: '/usr/bin'
            title: 'PerlCritic Executable Path'
            type: 'string'

    activate: ->
        console.log 'activate linter-perlcritic'
