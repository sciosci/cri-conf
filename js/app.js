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
      throw error;
    }
    // if (window.location.href.includes("index.html")) {
    //   await auth0.loginWithRedirect({
    //     redirect_uri: window.location.href,
    //   });
    // } else {
    //   window.location.href = "index.html";
    // }
  }
  await updateUI();

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
    $("#registrationSection").hide();
    const u = await auth0.getUser()
    await login_el.html(`Logout, ${u.nickname}!`);
    login_el.click(() => {
      auth0.logout({
        returnTo: window.location.origin
      });
    });
    const talk_info = await (await fetch("./talks.json")).json();
    const new_york_time = moment().tz("America/New_York");
    console.log(new_york_time.format());
    talk_info.forEach((e) => {
      const talk_link = $("#"+e.talk_id);
      const talk_time_start = moment(e.talk_datetime_start).tz("America/New_York");
      const talk_time_end = moment(e.talk_datetime_end).tz("America/New_York");
      if (talk_time_start.isBefore(new_york_time) && new_york_time.isBefore(talk_time_end)) {
        // talk is live
        talk_link.removeClass("btn-dark").removeClass("disabled").addClass("btn-primary");
        talk_link.attr("href", e.zoom_link);
        talk_link.attr("target", "_blank");
        $("#"+e.talk_id + " i").addClass("text-danger blink");
      } else {
      }
      // live: btn-primary, i class: text-danger blink
      // not live: btn-dark disabled btn-sm, i class: text-muted
    });
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