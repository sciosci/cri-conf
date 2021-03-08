let auth0;
const fetchAuthConfig = () => fetch("./auth_config.json");

authenticate = async () => {
    const response = await fetchAuthConfig();
    const config = await response.json();

    auth0 = await createAuth0Client({
        domain: config.domain,
        client_id: config.clientId
    });

    try {
        await auth0.getTokenSilently();
    } catch (error) {
        if (error.error !== "login_required") {
            $("#alert-message").html(error);
            console.log(error);
            throw error;
        }
    }
    // await updateUI();
    const string_image_generator = function (str, colidx) {
        return function (rowData, rowIdx) {
            return rowData[colidx].includes(str)
        }
    }
    let unique_speakers = new Set();
    await $("name").each((i, e) => {
        unique_speakers.add(e.innerHTML);
    });
    unique_speakers.delete("Daniel Acuna");
    let speaker_options = [];
    await unique_speakers.forEach((lab) => speaker_options.push({
        label: lab,
        value: function (rowData, rowIdx) {
            return (rowData[2].includes(lab) || rowData[3].includes(lab))
        }
    }))


    $("#talks-table").ready(() => {
        $('#talks-table').DataTable({
            paging: false,
            ordering: false,
            info: true,
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
                    },
                    targets: [2]

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
                columns: [0, 5, 2],
                cascadePanes: true,
            }
        });
    });
    // NEW - check for the code and state parameters
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        // Process the login state
        await auth0.handleRedirectCallback();

        // Use replaceState to redirect the user away and remove the querystring parameters
        window.history.replaceState({}, document.title, window.location.href.split('?')[0]);
    }
};

const updateUI = async () => {
    const authenticated = await auth0.isAuthenticated();
    const login_el = $("#login");

    const dt = await $('#talks-table').DataTable();
    let talk_info = {};

    if (authenticated) {
        const u = await auth0.getUser()
        await login_el.html(`Logout, ${u.nickname}!`);
        login_el.click(() => {
            auth0.logout({
                returnTo: window.location.origin
            });
        });
        const client_info = await auth0.getIdTokenClaims();
        const talk_list = client_info["https://cri-conf.org/talks"];
        await talk_list.forEach((e) => {
            talk_info[e.event_id] = e.url;
        });
    } else {
        await login_el.html("Login");
        login_el.click(() => {
            auth0.loginWithRedirect({
                redirect_uri: window.location.href,
            });
        });
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
                    $("#spotlight-watch").fadeIn().attr("href", talk_info[si.row.DT_RowId]);
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
            $("#spotlight-watch").hide();
        } else {
            $("#spotlight_card").fadeOut();
        }

    }
    login_el.fadeIn();
    $("#main").show();
    $("#spotlight").show();
}

// window.onload = authenticate();
$(window).ready(authenticate());