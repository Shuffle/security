<div style={{ backgroundColor: theme.palette.drawer.backgroundColor, padding: isMobile ? "0px 10px 50px 10px" : "25px 15px 150px 15px", maxWidth: isMobile ? "100%" : "100%", overflowX: "hidden", height: "100%"}}>


          <Breadcrumbs
            aria-label="breadcrumb"
            separator="›"
            style={{ color: theme.palette.text.primary, fontSize: 16 }}
          >
            <span
              style={{ color: "rgba(255,255,255,0.5)", display: "flex" }}
              onClick={() => {
                setExecutionRunning(false);
                stop();
                setExecutionModalView(0);
                setLastExecution(executionData.execution_id);
                // getWorkflowExecution(currentWorkflow.id, "");
                setTimeout(() => {
                  getWorkflowExecution(props.match.params.key, "");
                }, 100);
              }}
            >
              <IconButton
                style={{
                  paddingLeft: 0,
                  marginTop: "auto",
                  marginBottom: "auto",
                }}
                onClick={() => {
                  const newitem = removeParam("execution_id", cursearch);
                  navigate(curpath + newitem)
                  setExecutionRunning(false);
                  stop()
                }}
              >
                <ArrowBackIcon style={{ color: theme.palette.text.primary }} />
              </IconButton>
                <h2
                  style={{ color: theme.palette.text.primary, cursor: "pointer" }}
                  onClick={() => {
                    const newitem = removeParam("execution_id", cursearch);
                    navigate(curpath + newitem)
                    setExecutionRunning(false);
                    stop()
                  }}
                >
                  Back to all runs
                </h2>
            </span>
          </Breadcrumbs>
          <Divider
            style={{
              backgroundColor: theme.palette.defaultBorder,
              marginTop: 10,
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", paddingLeft: 10, paddingRight: 10, position: "sticky", top: 0, zIndex: 12500, backgroundColor: theme.palette.drawer.backgroundColor, borderRadius: theme.palette.borderRadius, border: "2px solid rgba(255,255,255,0.3)", marginBottom: 10, }}>
            <h2>Details</h2>
            <Tooltip
              color="primary"
              title={
				  <Typography variant="body1">
					Rerun workflow. Uses same startnode as the original. Runs from scratch.
				  </Typography>
			  }
              placement="left"
              style={{ zIndex: 50000 }}
            >
              <span style={{}}>
                <Button
                  color="primary"
                  style={{ float: "right", marginTop: 20, marginLeft: 10, }}
                  onClick={() => {
                    const skip_popup = true
                    executeWorkflow(
                      executionData.execution_argument,
                      executionData.start,
                      lastSaved,
                      skip_popup,
                    )

                    if (executionText === undefined || executionText === null || executionText.length === 0) {
                      setExecutionText(executionData.execution_argument)
                    }

                    setExecutionModalOpen(false);
                  }}
                >
                  <CachedIcon style={{}} />
                </Button>
              </span>
            </Tooltip>

            <Tooltip
              color="primary"
              title="Previous execution"
              placement="top"
              style={{ zIndex: 50000, }}
            >
              <span style={{}}>
                <Button
                color="primary"
                  style={{ float: "right", marginTop: 20, }}
                  onClick={() => {
                    // Find current one in execution list
                    var nextindex = -1
                    const currentIndex = workflowExecutions.findIndex((item) => item.execution_id === executionData.execution_id)
                    if (currentIndex === -1) {
                      nextindex = workflowExecutions.length - 1
                    } else {
                      nextindex = currentIndex - 1
                    }

                    if (nextindex < 0) {
                      toast.warn("Use the workflow run debugger to dig deeper - nothing more to show here.")
                      return
                    }

                    const data = workflowExecutions[nextindex]
                    navigate(`?execution_id=${data.execution_id}`)

                    changeExecution(data)
                  }}
                >
                  <ArrowBackIcon />
                </Button>
              </span>
            </Tooltip>

            <Tooltip
              color="primary"
              title="Next execution"
              placement="top"
              style={{ zIndex: 50000, }}
            >
              <span style={{}}>
                <Button
                  color="primary"
                  style={{ float: "right", marginTop: 20}}
                  onClick={() => {
                    // Find current one in execution list
                    var nextindex = -1
                    const currentIndex = workflowExecutions.findIndex((item) => item.execution_id === executionData.execution_id)
                    if (currentIndex === -1) {
                      nextindex = 0
                    } else {
                      nextindex = currentIndex + 1
                    }

                    if (nextindex >= workflowExecutions.length) {
                      toast.warn("Use the workflow run debugger to dig deeper - nothing more to show here.")
                      return
                    }

                    const data = workflowExecutions[nextindex]
                    navigate(`?execution_id=${data.execution_id}`)

                    changeExecution(data)
                  }}
                >
                  <ArrowForwardIcon />
                </Button>
              </span>
            </Tooltip>

            {executionData.status === "EXECUTING" ? (
              <Tooltip
                color="primary"
                title="Abort workflow"
                placement="top"
                style={{ zIndex: 50000 }}
              >
                <span style={{}}>
                  <Button
                    color="primary"
                    style={{ float: "right", marginTop: 20, }}
                    onClick={() => {
                      abortExecution();
                    }}
                  >
                    <PauseIcon style={{}} />
                  </Button>
                </span>
              </Tooltip>
            ) :
              <Tooltip
                color="primary"
                title={`Check Notifications (${executionData.notifications_created === undefined || executionData.notifications_created === null || executionData.notifications_created === 0 ? 0 : executionData.notifications_created})`}
                placement="top"
                style={{ zIndex: 50000 }}
              >
                <span style={{}}>
                  <Button
                    color={executionData.notifications_created === undefined || executionData.notifications_created === null || executionData.notifications_created === 0 ? "secondary" : "primary"}
                    style={{ float: "right", marginTop: 20, }}
                    disabled={executionData.notifications_created === undefined || executionData.notifications_created === null || executionData.notifications_created === 0}
                  >
                    <ErrorOutlineIcon
                      style={{}}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        window.open(`/admin?admin_tab=notifications&workflow=${executionData.workflow.id}&execution_id=${executionData.execution_id}`, "_blank")
                      }}
                    />
                  </Button>
                </span>
              </Tooltip>
            }

            {isCloud ?
              <Tooltip
                color="primary"
                title="Explore logs for the workflow (up to 5 days back)"
                placement="top"
                style={{ zIndex: 50000, }}
              >
                <span style={{}}>
                  <Button
                    color="secondary"
                    style={{ float: "right", marginTop: 20, }}

                    // Max 5 days in the past
                    disabled={executionData.started_at < (Math.floor(Date.now() / 1000) - 432000)}
                    onClick={() => {
                      toast("Opening logs in a new tab")

                      setTimeout(() => {
                        window.open(`${globalUrl}/api/v1/workflows/search/${executionData.execution_id}`, "_blank")
                      }, 250)
                    }}
                  >
                    <InsightsIcon />
                  </Button>
                </span>
              </Tooltip>
              : null}

          </div>

          {executionData.status !== undefined &&
            executionData.status.length > 0 ? (
            <div style={{ display: "flex", marginLeft: 10, }}>
              <Typography variant="body1">
                <b>Status &nbsp;&nbsp;</b>
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {executionData.status}
              </Typography>
            </div>
          ) : null}

          {executionData.execution_source !== undefined &&
            executionData.execution_source !== null &&
            executionData.execution_source.length > 0 &&
            executionData.execution_source !== "default" ||
            (executionData.authgroup !== undefined && executionData.authgroup !== null && executionData.authgroup.length > 0) ? (
            <div style={{ display: "flex", marginLeft: 10, }}>
              <Typography variant="body1">
                <b>Source &nbsp;&nbsp;</b>
              </Typography>
              <Typography variant="body1" color="textSecondary">

                {executionData?.execution_source?.startsWith("datastore") ?
					  <a
						rel="noopener noreferrer"
						href={`/admin?tab=datastore${executionData.execution_source.split("|").length > 2 ? "&category="+executionData.execution_source.split("|")[1]+"&key="+executionData.execution_source.split("|")[2] : ""}`}
						target="_blank"
						style={{ textDecoration: "none", color: theme.palette.linkColor }}
					  >
						Datastore Automation
					  </a>
					:
                executionData.execution_source === "authgroups" || (executionData.authgroup !== undefined && executionData.authgroup !== null && executionData.authgroup.length > 0) ?
                  <a
                    rel="noopener noreferrer"
                    href={`/admin?tab=app_auth`}
                    target="_blank"
                    style={{ textDecoration: "none", color: theme.palette.linkColor }}
                  >
                    Auth Group '{executionData.authgroup !== undefined && executionData.authgroup !== null && executionData.authgroup.length > 0 ? `${executionData.authgroup}` : null}'
                  </a>
                  :
                  executionData.execution_parent !== null &&
                    executionData.execution_parent !== undefined &&
                    executionData.execution_parent.length > 0 ? (
                    executionData.execution_source === props.match.params.key ?
                      <span
                        style={{ cursor: "pointer", color: "#FF8544" }}
                        onClick={(event) => {
                          getWorkflowExecution(
                            props.match.params.key,
                            executionData.execution_parent
                          );
                        }}
                      >
                        Parent Execution
                      </span>
                      :
                      <a
                        rel="noopener noreferrer"
                        href={`/workflows/${executionData.execution_source}?view=executions&execution_id=${executionData.execution_parent}`}
                        target="_blank"
                        style={{ textDecoration: "none", color: theme.palette.linkColor }}
                      >
                        Parent Workflow
                      </a>
                  )
                    :
                    executionData.execution_source === "questions" || executionData.execution_source === "web" || executionData.execution_source === "form" || executionData.execution_source === "forms" ?
                      <a
                        rel="noopener noreferrer"
                        href={`/forms/${executionData.workflow.id}`}
                        target="_blank"
                        style={{ textDecoration: "none", color: theme.palette.linkColor }}
                      >
                        Form
                      </a>
                      :
                      executionData.execution_source
                }
              </Typography>
            </div>
          ) : null}
          {executionData.started_at !== undefined ? (
            <div style={{ display: "flex", marginLeft: 10, }}>
              <Typography variant="body1">
                <b>Started &nbsp;&nbsp;</b>
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {new Date(executionData.started_at * 1000).toLocaleString("en-GB")}
              </Typography>
            </div>
          ) : null}
          {executionData.completed_at !== undefined &&
            executionData.completed_at !== null &&
            executionData.completed_at > 0 ? (
            <div style={{ display: "flex", marginLeft: 10, }}>
              <Typography variant="body1" onClick={() => {
                console.log(executionData)
              }}>
                <b>Finished &nbsp;</b>
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {new Date(executionData.completed_at * 1000).toLocaleString("en-GB")}
              </Typography>
            </div>

          ) : null}

          {executionData.workflow !== undefined && executionData.workflow !== null && executionData.workflow.actions !== undefined && executionData.workflow.actions !== null && executionData.workflow.actions.length > 0 ?

            <div style={{ display: "flex", marginLeft: 10, }}>
              <Typography variant="body1">

                {/*envStatus === "success" ?
					<Tooltip title="Environment is healthy" placement="top">
						<CheckCircleIcon style={{ color: "green" }} />
					</Tooltip>
					: envStatus === "failure" ?
					<Tooltip title="Environment is unhealthy" placement="top">
						<ErrorIcon style={{ color: "red" }} />
					</Tooltip>
				: null*/}

                <b style={{}}>Location &nbsp;</b>
              </Typography>

              <Typography variant="body1" color="textSecondary" style={{ color: "#FF8544", cursor: "pointer", }} onClick={() => {
                window.open("/admin?tab=locations", "_blank")
              }}>
                {executionData.workflow.actions[0].environment}
              </Typography>

            </div>
            : null}

          {userdata.support === true && executionData.workflow !== undefined && executionData.workflow !== null && executionData.status !== "EXECUTING" && executionData.status !== "ABORTED" ?
            <div style={{ marginTop: 5, marginBottom: 5, }}>
              <WorkflowValidationTimeline
                originalWorkflow={workflow}

                apps={apps}
                workflow={executionData.workflow}
                getParents={getParents}

                execution={executionData}
              />
            </div>
            : null}

          <div style={{ marginTop: 10 }} />

          {executionData.execution_argument !== undefined && executionData.execution_argument !== null &&
            executionData.execution_argument.length > 1
            ? parsedExecutionArgument()
            :
            null}

          <Divider
            style={{
              backgroundColor: theme.palette.defaultBorder,
              marginTop: 15,
              marginBottom: 20,
            }}
          />

          {executionData.results !== undefined &&
            executionData.results !== null &&
            executionData.results.length > 1 &&
            executionData.results.find(
              (result) =>
                result.status === "SKIPPED"
            ) ? (
            <FormControlLabel
              style={{ color: theme.palette.text.primary, marginBottom: 10 }}
              label={
                <div style={{ color: theme.palette.text.primary }}>
                  Show skipped actions
                </div>
              }
              control={
                <Switch
                  checked={showSkippedActions}
                  onChange={() => {
                    setShowSkippedActions(!showSkippedActions);
                  }}
                />
              }
            />
          ) : null}

          <div style={{ display: "flex", marginTop: 10, marginBottom: 30 }}>
            <div>
              {executionData.status !== undefined &&
                executionData.status !== "ABORTED" &&
                executionData.status !== "FINISHED" &&
                executionData.status !== "FAILURE" &&
                executionData.status !== "WAITING" &&
                !(executionData.results === undefined || executionData.results === null || (executionData.results.length === 0 && executionData.status === "EXECUTING")) ? (
                <div style={{}}>
                  <CircularProgress style={{ marginLeft: 145, marginBottom: 10, }} onClick={() => {
                    console.log(environments, defaultEnvironmentIndex, nonskippedResults)
                  }} />

                  {environments.length > 0 && defaultEnvironmentIndex < environments.length && nonskippedResults.length === 0 && environments[defaultEnvironmentIndex].Name !== "Cloud" ?
                    <Typography variant="body2" color="textSecondary" style={{}}>
                      No results yet. Is Orborus running for the "{environments[defaultEnvironmentIndex].Name}" environment? <a href="/admin?tab=locations" rel="noopener noreferrer" target="_blank" style={{ textDecoration: "none", color: "#f86a3e" }}>Find out here</a>. If the Workflow doesn't start within 30 seconds with Orborus running, contact support: <a href={`mailto:${supportEmail}`} rel="noopener noreferrer" target="_blank" style={{ textDecoration: "none", color: "#f86a3e" }}>{supportEmail}</a>
                    </Typography>
                    : null}
                </div>
              ) : null}
            </div>
          </div>

          {
            executionData.results === undefined ||
              executionData.results === null ||
              (executionData.results.length === 0 && executionData.status === "EXECUTING") ? (

              <div style={{}}>
                <CircularProgress style={{ marginLeft: 145, marginBottom: 10, }} />
                {environments.length > 0 && defaultEnvironmentIndex < environments.length && nonskippedResults.length === 0 && environments[defaultEnvironmentIndex].Name !== "Cloud" ?
                  <Typography variant="body2" color="textSecondary" style={{}}>
                    No results yet. Is Orborus running for the "{environments[defaultEnvironmentIndex].Name}" environment? <a href="/admin?tab=locations" rel="noopener noreferrer" target="_blank" style={{ textDecoration: "none", color: theme.palette.linkColor }}>Learn more</a>. If the Workflow doesn't start within 30 seconds with Orborus running, contact support: <a href={`mailto:${supportEmail}`} rel="noopener noreferrer" target="_blank" style={{ textDecoration: "none", color: theme.palette.linkColor }}>{supportEmail}</a>
                  </Typography>
                  :
                  null}
              </div>
            ) : (
              executionData.results.map((data, index) => {
                if (executionData.results.length !== 1 && !showSkippedActions && (data.status === "SKIPPED")) {
                  return null;
                }

          		const showRerun = new URLSearchParams(cursearch).get("rerun")
				if (showRerun === "true") {
          			const showNode = new URLSearchParams(cursearch).get("node")
					if (data.action.id !== showNode) {
						return null
					}
				}

                // FIXME: The latter replace doens't really work if ' is used in a string
                var showResult = data.result.trim();
                const validate = validateJson(showResult);

                const curapp = apps.find(
                  (a) =>
                    a.name === data.action.app_name &&
                    a.app_version === data.action.app_version
                );
                const imgsize = 50;
                const statusColor =
                  data.status === "FINISHED" || data.status === "SUCCESS"
                    ? green
                    : data.status === "ABORTED" || data.status === "FAILURE"
                      ? "red"
                      : yellow;

                var imgSrc = curapp === undefined ? "" : curapp.large_image;
                if (imgSrc.length === 0 && workflow.actions !== undefined && workflow.actions !== null) {
                  // Look for the node in the workflow
                  const action = workflow.actions.find(
                    (action) => action.id === data.action.id
                  )
                  if (action !== undefined && action !== null) {
                    imgSrc = action.large_image;
                  }
                }

                if ((imgSrc === undefined || imgSrc === null || imgSrc.length === 0) && cy !== undefined && cy !== null) {
                  const foundnode = cy.getElementById(data.action.id)
                  if (foundnode !== undefined && foundnode !== null && foundnode.length > 0) {
                    // FIXME: Find image from cytoscape action
                  } else {
                    for (let actionkey in workflow.actions) {
                      if (workflow.actions[actionkey].app_name === data.action.app_name || workflow.actions[actionkey].id === data.action.id || workflow.actions[actionkey].label === data.action.label || workflow.actions[actionkey].name === data.action.name) {

                        if (workflow.actions[actionkey].large_image !== undefined && workflow.actions[actionkey].large_image !== null && workflow.actions[actionkey].large_image.length > 0) {
                          imgSrc = workflow.actions[actionkey].large_image
                          break
                        }
                      }
                    }
                  }
                }


                // Fallback: if large_image is still missing, look up by app_id in the apps state
                if ((imgSrc === undefined || imgSrc === null || imgSrc.length === 0) && data.action.label && apps.length > 0) {
                  const appById = apps.find((a) => a.name === data.action.label);
                  if (appById !== undefined && appById !== null && appById.large_image) {
                    imgSrc = appById.large_image;
                  }
                }

                var actionimg =
                  curapp === null ? null : (
                    <img
                      alt={data.action.app_name}
                      src={imgSrc}
                      style={{
                        marginRight: 20,
                        width: imgsize,
                        height: imgsize,
                        border: `2px solid ${statusColor}`,
                        borderRadius: executionData.start === data.action.id ? 25 : 5,

						cursor: isCloud ? "pointer" : "default",
                      }}
					  onClick={() => {
						  if (isCloud) { 
							window.open(`/apps/${data?.action?.app_name}`, "_blank")
						  }
					  }}
                    />
                  );

                if (triggers.length > 2) {
                  if (data.action.app_name === "shuffle-subflow") {
                    const parsedImage = triggers[3].large_image;
                    actionimg = (
                      <img
                        alt={"Shuffle Subflow"}
                        src={parsedImage}
                        style={{
                          marginRight: 20,
                          width: imgsize,
                          height: imgsize,
                          border: `2px solid ${statusColor}`,
                          borderRadius: executionData.start === data.action.id ? 25 : 5,
                        }}
                      />
                    );
                  }

                  if (data?.action?.name === "User Input" || data?.action?.app_name === "User Input" || data?.action?.name === "run_userinput") {
                    actionimg = (
                      <img
                        alt={"User Input Trigger"}
                        src={triggers[4].large_image}
                        style={{
                          marginRight: 20,
                          width: imgsize,
                          height: imgsize,
                          borderRadius: executionData.start === data.action.id ? 25 : 5,
                        }}
                      />
                    );
                  }
                }

                if (data.action.app_name === "Shuffle Tools" && data.action.id !== undefined && cy !== undefined) {
                  const nodedata = cy.getElementById(data.action.id).data();
                  //if (nodedata !== undefined && nodedata !== null && nodedata.fillstyle === "linear-gradient") {
                  const img = apps.find((a) => a.name === "Shuffle Tools")?.large_image
                  if (nodedata !== undefined && nodedata !== null) {
                    var imgStyle = {
                      marginRight: 20,
                      width: imgsize,
                      height: imgsize,
                      border: `2px solid ${statusColor}`,
                      borderRadius: executionData.start === data.action.id ? 25 : 5,
                      background: `linear-gradient(to right, ${nodedata.fillGradient})`,
                    };

                    actionimg = (
                      <img
                        alt={nodedata.label}
                        src={nodedata.large_image || img}
                        style={imgStyle}
                      />
                    );
                  } else {
                    //console.log("Node not found: ", nodedata)
                    actionimg = (
                      <img
                        alt={data.action.app_name}
                        src={data.action.large_image || img}
                        style={{
                          marginRight: 20,
                          width: imgsize,
                          height: imgsize,
                          border: `2px solid ${statusColor}`,
                          borderRadius: executionData.start === data.action.id ? 25 : 5,
                        }}
                      />
                    )
                  }
                }

                if (validate.valid && typeof validate.result === "string") {
                  validate.result = JSON.parse(validate.result);
                }

                if (validate.valid && typeof validate.result === "object") {
                  if (
                    validate.result.result !== undefined &&
                    validate.result.result !== null
                  ) {
                    try {
                      validate.result.result = JSON.parse(validate.result.result);
                    } catch (e) {
                      //console.log("ERROR PARSING: ", e)
                    }
                  }
                }


                var similarActionsView = null
                if (data.similar_actions !== undefined && data.similar_actions !== null) {
                  var minimumMatch = 85
                  var matching_executions = []
                  if (data.similar_actions !== undefined && data.similar_actions !== null) {
                    for (let [k, kval] in Object.entries(data.similar_actions)) {
                      if (data.similar_actions.hasOwnProperty(k)) {
                        if (data.similar_actions[k].similarity > minimumMatch) {
                          matching_executions.push(data.similar_actions[k].execution_id)
                        }
                      }
                    }
                  }

                  if (matching_executions.length !== 0) {
                    var parsed_url = matching_executions.join(",")

                    similarActionsView =
                      <Tooltip
                        color="primary"
                        title="See executions with similar results (not identical)"
                        placement="top"
                        style={{ zIndex: 50000, marginLeft: 50, }}
                      >
                        <IconButton
                          style={{
                            marginTop: "auto",
                            marginBottom: "auto",
                            height: 30,
                            paddingLeft: 0,
                            width: 30,
                          }}
                          onClick={() => {
                            navigate(`?execution_highlight=${parsed_url}`)
                          }}
                        >
                          <PreviewIcon style={{ color: "rgba(255,255,255,0.5)" }} />
                        </IconButton>
                      </Tooltip>
                  }
                }

                const chosenNodeId = new URLSearchParams(cursearch).get("node");
                const highlightNode = chosenNodeId !== null && chosenNodeId !== undefined && chosenNodeId !== "" && chosenNodeId === data.action.id
				var relevant_errors = []
				if (data?.action?.parameters !== undefined && data?.action?.parameters !== null && data?.action?.parameters.length > 0) {
					for (var i = 0; i < data.action.parameters.length; i++) {
						// Specific error patterns in params
						const param = data.action.parameters[i]
						if (param?.name?.endsWith("_error") && (param?.name?.startsWith("shuffle_") || param?.name?.startsWith("liquid_"))) {
							relevant_errors.push(param)
						}
					}
				}

				if (relevant_errors.length === 0) {
					const foundError = getErrorSuggestion(validate.result)
					if (foundError !== undefined && foundError !== null && foundError !== "") {
						relevant_errors = [foundError]
					}
				}

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: 20,
                      border: highlightNode ? `2px solid ${red}`
                        :
                        data.action.sub_action === true
                          ? "1px solid rgba(255,255,255,0.3)"
                          : "1px solid rgba(255,255,255, 0.3)",
                      borderRadius: theme.palette?.borderRadius,
                      backgroundColor: theme.palette.cardBackgroundColor,
                      padding: "15px 10px 10px 10px",
                      overflow: "hidden",
                    }}
                    onMouseOver={() => {
                      if (cy == undefined || cy == null) {
                        return
                      }

                      var currentnode = cy.getElementById(data.action.id);
                      if (currentnode !== undefined && currentnode !== null && currentnode.length !== 0) {
                        currentnode.addClass("shuffle-hover-highlight");
                      }

                      // Add a hover highlight

                      //var copyText = document.getElementById(
                      //	"copy_element_shuffle"
                      //)
                    }}
                    onMouseOut={() => {
                      if (cy == undefined || cy == null) {
                        return
                      }

                      var currentnode = cy.getElementById(data.action.id);
                      if (currentnode.length !== 0) {
                        currentnode.removeClass("shuffle-hover-highlight");
                      }
                    }}
                  >
                    <div style={{ display: "flex" }}>
                      <div style={{ display: "flex", marginBottom: 15 }}>
                        <IconButton
                          style={{
                            marginTop: "auto",
                            marginBottom: "auto",
                            height: 30,
                            paddingLeft: 0,
                            width: 30,
                          }}
                          onClick={() => {
                            if (cy !== undefined && cy !== null) {
                              const oldstartnode = cy.getElementById(data.action.id);
                              //console.log("FOUND NODe: ", oldstartnode)
                              if (oldstartnode !== undefined && oldstartnode !== null) {
                                const foundname = oldstartnode.data("label")
                                if (foundname !== undefined && foundname !== null) {
                                  data.action.label = foundname
                                }
                              }

                              //console.log("Click data: ", data)
                              //data.action.label = ""
                              setSelectedResult(data);
                              setActiveDialog("result")
                              setCodeModalOpen(true);
                            } else {
                              //toast("Please wait until the workflow is loaded and try again")
                              setCodeModalOpen(true)
                              setSelectedResult(data)

                            }
                          }}
                        >
                          <Tooltip
                            color="primary"
                            title={
								<Typography variant="body1">
									Expand debug window. Errors: {relevant_errors.length}
								</Typography>
							}
                            placement="top"
                            style={{ zIndex: 50000 }}
                          >
                            <ArrowLeftIcon style={{ 
								color: relevant_errors.length > 0 ? red : theme.palette.textColor,
							}} />
                          </Tooltip>
                        </IconButton>
                        {actionimg}
                        <div>
                          <div
                            style={{
                              fontSize: 24,
                              marginTop: "auto",
                              marginBottom: "auto",
                            }}
                          >
                            <b>{data.action.label === undefined || data.action.label === null || data.action.label === "" ? data.action.label : data.action.label.replaceAll("_", " ")}</b>

                          </div>
                          <div style={{ fontSize: 14 }}>
                            <Typography variant="body2" color="textSecondary">
                              {data.action.name}
                            </Typography>
                          </div>
                        </div>
                      </div>

					  {data.action.app_name === "AI Agent" || data.action.app_name === "Shuffle Agent" ? 
                        <span
                          style={{ flex: 10, float: "right", textAlign: "right" }}
                        >
						  <Tooltip title={"Explore Agent Timeline"}>
							  <a
								rel="noopener noreferrer"
								href={`/agents?execution_id=${executionData.execution_id}&authorization=${executionData.authorization}&node_id=${data.action.id}`}
								target="_blank"
								style={{
								  textDecoration: "none",
								  color: theme.palette.linkColor,
								}}
								onClick={(event) => { }}
							  >
								<OpenInNewIcon />
							  </a>
						  </Tooltip>
						</span>
					  : null}

                      {data?.action?.name === "run_schemaless" || data?.action?.name === "run_singul" || data?.action?.name === "singul" && data?.action?.parameters?.length > 4 ?  
							<div
						  		style={{position: "relative", flex: 10, float: "right", textAlign: "right", }}
							>
							  <Tooltip title={`Explore the raw debug-output: ${data?.action?.parameters?.find((param) => param?.name === "x-debug-url")?.value || ""}`}>
								  <a
									rel="noopener noreferrer"
									href={data?.action?.parameters?.find((param) => param?.name === "x-debug-url")?.value || ""}
									target="_blank"
									style={{
									  textDecoration: "none",
									  color: "rgba(255,255,255,0.4)",
									}}
								  >
									<OpenInNewIcon />
								  </a>
							  </Tooltip>
							  <div style={{position: "absolute", top: 30, right: 0, }}> 
								  <Tooltip title={"Explore in datastore"}>
									  <a
										rel="noopener noreferrer"
										href={`/admin?tab=datastore&category=${data?.action?.parameters?.find((param) => param?.name === "action")?.value || ""}&src=workflow`}
										target="_blank"
										style={{
										  textDecoration: "none",
										}}
									  > 
										<StorageIcon style={{color: "#f85a3e", }} />
									  </a>
								  </Tooltip>
							  </div>
							</div>
						: null}

                      {data.action.app_name === "shuffle-subflow" &&
                        validate.result.success !== undefined &&
                        validate.result.success === true ? (
                        <span
                          style={{ flex: 10, float: "right", textAlign: "right" }}
                        >
                          {validate.valid &&
                            data.action.parameters !== undefined &&
                            data.action.parameters !== null &&
                            data.action.parameters.length > 0 ? (
                            data.action.parameters[0].value ===
                              props.match.params.key ? (
                              <span
                                style={{ cursor: "pointer", color: "#FF8544" }}
                                onClick={(event) => {
                                  getWorkflowExecution(
                                    props.match.params.key,
                                    validate.result.execution_id
                                  );
                                }}
                              >
                                <OpenInNewIcon />
                              </span>
                            ) : (
                              <a
                                rel="noopener noreferrer"
                                href={`/workflows/${data.action.parameters[0].value}?view=executions&execution_id=${validate.result.execution_id}`}
                                target="_blank"
                                style={{
                                  textDecoration: "none",
                                  color: theme.palette.linkColor,
                                }}
                                onClick={(event) => { }}
                              >
                                <OpenInNewIcon />
                              </a>
                            )
                          ) : (
                            ""
                          )}
                        </span>
                      ) : null}
                    </div>

                    {data.status !== "SUCCESS" ?
                      <div style={{ marginBottom: 5, display: "flex" }}>
                        <Typography variant="body1">
                          <b>Status&nbsp;</b>
                        </Typography>
                        <Typography variant="body1" color="textSecondary" style={{ marginRight: 15, }}>
                          {data.status}
                        </Typography>
                        {similarActionsView}
                      </div>
                      : null}

                    {validate.valid ? (
                      <span>
                        <ReactJson
                          src={validate.result}
                          theme={theme.palette.jsonTheme}
                          style={theme.palette.reactJsonStyle}
                          shouldCollapse={(jsonField) => {
                            return collapseField(jsonField)
                          }}
                          iconStyle={theme.palette.jsonIconStyle}
                          collapseStringsAfterLength={theme.palette.jsonCollapseStringsAfterLength}
                          displayArrayKey={false}
                          enableClipboard={(copy) => {
                            handleReactJsonClipboard(copy);
                          }}
                          displayDataTypes={false}
                          onSelect={(select) => {
                            HandleJsonCopy(showResult, select, data.action.label);
                            console.log("SELECTED!: ", select);
                          }}
                          name={`$${data?.action?.label?.toLowerCase()}`}
                        />

                      </span>
                    ) : (
                      <div
                        style={{
                          maxHeight: 250,
                          overflowX: "hidden",
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
						{validate?.result?.length > 0 ? 
							<div>
								<Typography
								  variant="body1"
								  style={{}}
								>
								  <b>Result</b>&nbsp;
								</Typography>
								<Typography
								  variant="body1"
								  color="textSecondary"
								  style={{ display: "inline-block" }}
								>
								  {data.result}
								</Typography>
							</div>
						: null}
                      </div>
                    )}
                  </div>
                );
              })
            )}
