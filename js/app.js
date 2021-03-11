let auth0;
const fetchAuthConfig = () => fetch("./auth_config.json");

authenticate = async () => {
    const response = await fetchAuthConfig();
    const config = await response.json();

    try {
        auth0 = await createAuth0Client({
            domain: config.domain,
            client_id: config.clientId,
            setRefreshTokens: true,
            cacheLocation: 'localstorage'
        });
        await auth0.getTokenSilently();
    } catch (error) {
        if (error.error !== "login_required") {
            const href = `https://${config.domain}/v2/logout?` +
                `client_id=${config.clientId}&` +
                `returnTo=${window.location.href}`;
            $("#alert-message").html("<h5>" + error + "</h5>" +
                "<p>If you believe this is an error, please email " +
                "<a href='mailto:contact@cri-conf.org'>contact@cri-conf.org</a></p>" +
                `<p><a href="${href}" class="btn btn-danger">Try again</a></p>`);
            console.log(error);
            $("#alert-section").show();
            $("#login").addClass("disabled");
        }
    }

    const string_image_generator = function (str, colidx) {
        return function (rowData, rowIdx) {
            return rowData[colidx].includes(str)
        }
    }
    let unique_speakers = new Set();
    await $("span.name").each((i, e) => {
        unique_speakers.add(e.innerHTML);
    });
    let speaker_options = [];
    await unique_speakers.forEach((lab) => speaker_options.push({
        label: lab,
        value: function (rowData, rowIdx) {
            return (rowData[2].includes("<span class=\"name\">" + lab + "</span>"))
        }
    }));

    $('#talks-table').DataTable({
        paging: false,
        ordering: false,
        info: true,
        responsive: true,
        stateSave: true,
        order: [[0, 'desc']],
        rowGroup: {
            dataSrc: 0,
            startRender: function (rows, group) {
                return $.fn.dataTable.render.moment('dddd, MMMM D, YYYY')(group)
            }
        },
        columnDefs: [
            {
                targets: [0, 4, 5],
                visible: false
            },
            {
                width: "10%",
                targets: 1
            },
            {
                width: "30%",
                targets: 2,
            },
            {
                searchPanes: {
                    options: speaker_options,
                    header: "Presenter"
                },
                targets: [1]
            },
            {
                render: $.fn.dataTable.render.moment('dddd MMMM D'),
                targets: [0]
            }
        ],
        // deferRender: true,
        initComplete: updateUI,
        autoWidth: false,
        dom: 'Plfrtip',
        searchPanes: {
            layout: 'columns-3',
            columns: [0, 5, 1],
            cascadePanes: true,
        }
    });

    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        // Process the login state
        await auth0.handleRedirectCallback();

        // Use replaceState to redirect the user away and remove the querystring parameters
        window.history.replaceState({}, document.title, window.location.href.split('?')[0]);
    }
};

const updateUI = async () => {
    let authenticated;
    try {
        authenticated = await auth0.isAuthenticated();
    } catch (e) {
        authenticated = false;
    }

    const login_el = $("#login");

    const dt = await $('#talks-table').DataTable();
    let zoom_link = "";

    if (authenticated) {
        const u = await auth0.getUser()
        await login_el.html(`Logout, ${u.nickname}!`);
        login_el.click(() => {
            auth0.logout({
                returnTo: window.location.href
            });
        });
        const client_info = await auth0.getIdTokenClaims();
        zoom_link = client_info["https://cri-conf.org/talks"];
    } else {
        await login_el.html("Login or Sign up");
        try {
            login_el.click(() => {
                auth0.loginWithRedirect({
                    redirect_uri: window.location.href,
                });
            });
        } catch (e) {
            login_el.addClass("disabled");
        }
    }

    let slot_information = [];
    let rn = moment().tz("America/New_York");
    for (let i = 0; i < dt.rows().data().length; i++) {
        const slot_timestamp = dt.rows().data()[i][0] + " " + dt.rows().data()[i][1];
        const m = moment(slot_timestamp, "YYYY-MM-DD hh:mm A").tz("America/New_York");
        slot_information.push({
            start: m,
            row: dt.rows().data()[i]
        });
    }

    // Create endtime
    let matched_event = false;
    for (let i = 0; i < slot_information.length; i++) {
        const si = slot_information[i];
        if (i < slot_information.length - 1) {
            const next_si = slot_information[i + 1];
            // event is in same day
            if (si.start.day() === next_si.start.day()) {
                si.end = next_si.start;

                if ((rn.isAfter(si.start) && rn.isBefore(si.end))) {
                    // This is the event that we need to show
                    $("#spotlight-tag").html("Current event");
                    let timerId = 0;
                    timerId =
                        countdown(
                            si.start,
                            function (ts) {
                                $("#spotlight-status").html("<span class=\"text-success\">Live (" + ts.toHTML() + ")</span>");
                                if (si.end.diff(si.start) <= ts.value) {
                                    window.clearInterval(timerId);
                                    updateUI();
                                }
                            },
                            countdown.HOURS | countdown.MINUTES | countdown.SECONDS);
                    $("#spotlight-date").html(
                        si.start.format("dddd, MMMM D (hh:mm A") + " - " + si.end.format("hh:mm A)")
                    );
                    $("#spotlight-title").html(
                        si.row[2]
                    );
                    $("#spotlight-info").html(
                        si.row[3]
                    );
                    let spotlight_watch = $("#spotlight-watch");
                    if (authenticated) {
                        spotlight_watch.fadeIn().removeClass("disabled").removeClass("btn-light").addClass("btn-primary");
                        spotlight_watch.attr("href", zoom_link).html("Join <i class=\"fa fa-external-link\"></i>");
                    } else {
                        spotlight_watch.hide();
                    }
                    matched_event = true;
                }
            }
        }
    }

    // closest next event
    if (!matched_event) {
        let min_diff = Infinity;
        let si;
        for (let i = 0; i < slot_information.length; i++) {
            const diff = slot_information[i].start.diff(rn);
            if (diff < min_diff && diff >= 0) {
                min_diff = diff;
                si = slot_information[i];
            }
        }
        if (min_diff >= 0) {
            let timerId = 0;
            timerId =
                countdown(
                    si.start,
                    function (ts) {
                        if (ts.value < 0) {
                            $("#spotlight-status").html("In " + ts.toHTML());
                        } else {
                            window.clearInterval(timerId);
                            updateUI();
                        }
                    },
                    countdown.WEEKS | countdown.DAYS | countdown.HOURS | countdown.MINUTES | countdown.SECONDS,
                    3);

            // This is the event that we need to show
            $("#spotlight-tag").html("Next event");
            $("#spotlight-date").html(
                si.start.format("dddd, MMMM D (hh:mm A") + " - " + si.end.format("hh:mm A)")
            );
            $("#spotlight-title").html(
                si.row[2]
            );
            $("#spotlight-info").html(
                si.row[3]
            );
            let spotlight_watch = $("#spotlight-watch");
            if (authenticated) {
                spotlight_watch.fadeIn().addClass("disabled").addClass("btn-light").removeClass("btn-primary");
                spotlight_watch.attr("href", "#").html("Join <i class=\"fa fa-external-link\"></i>");
            } else {
                $("#spotlight-watch").hide();
            }

        } else {
            $("#spotlight_card").fadeOut();
        }

    }
    login_el.fadeIn();
    $("#main").show();
    $("#loading").hide();
    $("#spotlight").show();
}

// window.onload = authenticate();
$(window).ready(authenticate());