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
                dataSrc: 0
            },
            columnDefs: [
                {
                    targets: [0, 5],
                    visible: false
                },
                {
                    width: "10%",
                    targets: 1
                },
                {
                    width: "15%",
                    targets: 2,
                },
                {
                    searchPanes: {
                        options: speaker_options,
                    },
                    targets: [2]

                }
            ],
            // deferRender: true,
            initComplete: updateUI,
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
        window.history.replaceState({}, document.title, "/");
    }
};

const updateUI = async () => {
    const authenticated = await auth0.isAuthenticated();
    const login_el = $("#login");
    if (authenticated) {
        const u = await auth0.getUser()
        await login_el.html(`Logout, ${u.nickname}!`);
        login_el.click(() => {
            auth0.logout({
                returnTo: window.location.origin
            });
        });
        const client_info = await auth0.getIdTokenClaims();
        const talk_info = client_info["https://cri-conf.org/talks"];
        console.log(talk_info);
        await $("div.zoomLinks").show();
        talk_info.forEach((e) => {
            const talk_link = $("#" + e.event_id + " a");
            console.log(talk_link);
            console.log(talk_link.attr("id"));
            talk_link.removeClass("btn-dark").removeClass("disabled").addClass("btn-primary");
            talk_link.attr("href", e.url);
            talk_link.attr("target", "_blank");
            $("#" + e.event_id + " a i").addClass("text-danger blink");
        });

        // await talk_info.forEach(async (e) => {
        //     const talk_link = await $("#" + e.talk_id);
        //     const talk_time_start = moment(e.talk_datetime_start);
        //     const talk_time_end = moment(e.talk_datetime_end);
        //     if (talk_time_start.isBefore(new_york_time) && new_york_time.isBefore(talk_time_end)) {
        //         // talk is live
        //         talk_link.removeClass("btn-dark").removeClass("disabled").addClass("btn-primary");
        //         talk_link.attr("href", e.zoom_link);
        //         talk_link.attr("target", "_blank");
        //         $("#" + e.talk_id + " i").addClass("text-danger blink");
        //     } else {
        //     }
        //     // live: btn-primary, i class: text-danger blink
        //     // not live: btn-dark disabled btn-sm, i class: text-muted
        // });
        // const talk_info = await (await fetch("talks.json")).json();
        // const new_york_time = moment().tz("America/New_York");
        // console.log(new_york_time.format());
        // talk_info.forEach((e) => {
        //     const talk_link = $("#" + e.talk_id);
        //     const talk_time_start = moment(e.talk_datetime_start);
        //     const talk_time_end = moment(e.talk_datetime_end);
        //     if (talk_time_start.isBefore(new_york_time) && new_york_time.isBefore(talk_time_end)) {
        //         // talk is live
        //         talk_link.removeClass("btn-dark").removeClass("disabled").addClass("btn-primary");
        //         talk_link.attr("href", e.zoom_link);
        //         talk_link.attr("target", "_blank");
        //         $("#" + e.talk_id + " i").addClass("text-danger blink");
        //     } else {
        //     }
        //     // live: btn-primary, i class: text-danger blink
        //     // not live: btn-dark disabled btn-sm, i class: text-muted
        // });
    } else {
        await login_el.html("Login");
        login_el.click(() => {
            auth0.loginWithRedirect({
                redirect_uri: window.location.href,
            });
        });
    }
    login_el.fadeIn();
}

// window.onload = authenticate();
$(window).ready(authenticate());